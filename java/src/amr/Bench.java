package amr;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

/**
 * Wall-clock benchmark for the Java AMR-NB decoder.
 *
 * Usage: java amr.Bench <in.amr> [<in.amr> ...]
 *
 * Decodes all files sequentially in 3 passes (pass 1 = JIT warmup, discarded)
 * and prints: frames, audio seconds, elapsed ms, realtime factor, ms/frame,
 * samples/sec. Also emits a "::warning" workflow command so the numbers are
 * visible in the GitHub Actions run annotations.
 */
public final class Bench {
    private Bench() {}

    public static void main(String[] args) throws IOException {
        if (args.length < 1) {
            System.err.println("usage: java amr.Bench <in.amr> [<in.amr> ...]");
            System.exit(2);
        }

        byte[][] datas = new byte[args.length][];
        long totalFrames = 0;
        for (int i = 0; i < args.length; i++) {
            datas[i] = DecTool.readAll(new File(args[i]));
            int off = DecTool.isMagic(datas[i]) ? 6 : 0;
            while (off + 1 <= datas[i].length) {
                int type = (datas[i][off] >> 3) & 0x0f;
                int size = DecTool.FRAME_SIZE[type];
                if (off + size > datas[i].length) {
                    break;
                }
                off += size;
                totalFrames++;
            }
        }
        final double audioSec = totalFrames * 0.02;

        byte[] frame = new byte[32];
        short[] pcm = new short[160];

        /* pass 1: warm up the JIT */
        decodeOnce(datas, frame, pcm);
        /* passes 2..4: measure */
        long best = Long.MAX_VALUE;
        for (int pass = 0; pass < 3; pass++) {
            long t0 = System.nanoTime();
            decodeOnce(datas, frame, pcm);
            long t1 = System.nanoTime();
            long ms = (t1 - t0) / 1000000;
            if (ms < best) {
                best = ms;
            }
        }

        double rt = audioSec / (best / 1000.0);
        String summary = String.format(
            "frames=%d audio=%.0fs elapsed=%dms realtime=%.0fx ms/frame=%.3f samples/s=%.0f",
            totalFrames, audioSec, best, rt, best / (double) totalFrames,
            totalFrames * 160.0 / (best / 1000.0));
        System.out.println("Java bench: " + summary);
        System.out.println("::warning title=amr-java-bench::" + summary);
    }

    private static void decodeOnce(byte[][] datas, byte[] frame, short[] pcm) {
        SpDec.State dec = AmrDecode.Decoder_Interface_init();
        for (int i = 0; i < datas.length; i++) {
            byte[] data = datas[i];
            int off = DecTool.isMagic(data) ? 6 : 0;
            while (off + 1 <= data.length) {
                int type = (data[off] >> 3) & 0x0f;
                int size = DecTool.FRAME_SIZE[type];
                if (off + size > data.length) {
                    break;
                }
                System.arraycopy(data, off, frame, 0, size);
                AmrDecode.Decoder_Interface_Decode(dec, frame, pcm, 0);
                off += size;
            }
        }
    }
}
