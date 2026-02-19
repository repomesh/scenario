/**
 * Real-time audio player for streaming PCM16 audio during tests.
 *
 * Uses `ffplay` (from ffmpeg) to play raw PCM16 audio chunks in real-time
 * as they arrive from the OpenAI Realtime API transport layer.
 *
 * Audio format: signed 16-bit little-endian, 24kHz, mono (matches OpenAI Realtime API output).
 *
 * If ffplay is not installed, it logs a warning and silently skips playback (CI-safe).
 */

import { spawn, type ChildProcess } from "child_process";

const SAMPLE_RATE = 24000;
const BYTES_PER_SAMPLE = 2; // 16-bit
const SILENCE_BETWEEN_SPEAKERS_MS = 300;
const SILENCE_BYTES =
  SILENCE_BETWEEN_SPEAKERS_MS * (SAMPLE_RATE / 1000) * BYTES_PER_SAMPLE;

export class RealtimeAudioPlayer {
  private process: ChildProcess | null = null;
  private currentSpeaker: string = "";
  private available = false;

  /**
   * Start the audio player process.
   * Spawns ffplay reading raw PCM16 from stdin.
   * If ffplay is not available, logs a warning and becomes a no-op.
   */
  start(): void {
    if (this.available) return;

    this.process = spawn(
      "ffplay",
      [
        "-f",
        "s16le", // signed 16-bit little-endian PCM
        "-ar",
        String(SAMPLE_RATE), // 24kHz sample rate
        "-ch_layout",
        "mono", // single channel
        "-nodisp", // no GUI window
        "-autoexit", // exit when playback finishes
        "-loglevel",
        "quiet", // suppress ffplay logs
        "pipe:0", // read from stdin
      ],
      {
        stdio: ["pipe", "ignore", "ignore"],
      }
    );

    // Handle EPIPE errors on stdin (e.g. ffplay exits early)
    this.process.stdin?.on("error", () => {
      // Silently ignore — ffplay may have exited
    });

    this.process.on("error", (err) => {
      console.warn(
        `[RealtimeAudioPlayer] ffplay not available: ${err.message}`
      );
      console.warn(
        "[RealtimeAudioPlayer] Install ffmpeg to enable real-time audio playback: brew install ffmpeg"
      );
      this.process = null;
      this.available = false;
    });

    this.process.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.warn(
          `[RealtimeAudioPlayer] ffplay exited with code ${code}`
        );
      }
      this.available = false;
    });

    this.available = true;
    console.log("[RealtimeAudioPlayer] Streaming audio playback started");
  }

  /**
   * Feed a base64-encoded PCM16 audio chunk to the player.
   * Call this with each `response.output_audio.delta` event from the transport.
   *
   * @param base64Chunk - Base64-encoded PCM16 audio data
   * @param speaker - Optional speaker name, used to insert silence between speaker changes
   */
  feedChunk(base64Chunk: string, speaker?: string): void {
    if (!this.available || !this.process?.stdin?.writable) return;

    // Insert brief silence when speaker changes for a natural conversation feel
    if (speaker && speaker !== this.currentSpeaker) {
      if (this.currentSpeaker !== "") {
        const silence = Buffer.alloc(SILENCE_BYTES, 0);
        this.process.stdin.write(silence);
      }
      this.currentSpeaker = speaker;
    }

    const decoded = Buffer.from(base64Chunk, "base64");
    this.process.stdin.write(decoded);
  }

  /**
   * Stop the player, waiting for buffered audio to finish playing.
   * Returns a promise that resolves when ffplay has exited.
   */
  async stop(): Promise<void> {
    if (!this.process) return;

    const proc = this.process;
    this.process = null;
    this.available = false;

    return new Promise<void>((resolve) => {
      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          console.log("[RealtimeAudioPlayer] Playback finished");
          resolve();
        }
      };

      proc.on("close", done);

      // Close stdin so ffplay plays remaining buffer and exits
      proc.stdin?.end();

      // Safety timeout — don't hang the test if ffplay stalls
      setTimeout(() => {
        if (!resolved) {
          proc.kill();
          done();
        }
      }, 5000);
    });
  }
}

/**
 * Hook a RealtimeAudioPlayer into an OpenAI Realtime session's transport layer.
 *
 * Must be called AFTER the session is connected (transport is only available post-connection).
 *
 * @param session - The OpenAI RealtimeSession (after connect())
 * @param player - The RealtimeAudioPlayer instance
 * @param speaker - Label for this speaker (used for silence insertion between turns)
 */
export function hookTransportToPlayer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any,
  player: RealtimeAudioPlayer,
  speaker: string
): void {
  const transport = session?.transport;

  if (!transport) {
    console.warn(
      `[RealtimeAudioPlayer] No transport found on session for "${speaker}" — audio won't stream`
    );
    return;
  }

  transport.on("response.output_audio.delta", (event: unknown) => {
    const delta = (event as { delta?: string }).delta;
    if (typeof delta === "string") {
      player.feedChunk(delta, speaker);
    }
  });

  console.log(
    `[RealtimeAudioPlayer] Hooked into transport for "${speaker}"`
  );
}
