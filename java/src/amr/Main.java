package amr;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * CLI for the AMR-NB decoder (used by java/test.sh, also handy standalone).
 *
 *   java amr.Main dec <in.amr|inDir> <out.pcm|outDir>
 *   java amr.Main bench <in.amr> [<in.amr> ...]
 *
 * dec writes raw 16-bit signed little-endian PCM, 8 kHz mono.
 * bench prints wall-clock timings (3 passes, best of last 3, 1 warmup).
 */
public final class Main {
    private Main() {}

    static final int[] FRAME_SIZE = {
        13, 14, 16, 18, 20, 21, 27, 32, 6, 1, 1, 1, 1, 1, 1, 1
    };
    static final byte[] MAGIC = { 0x23, 0x21, 0x41, 0x4d, 0x52, 0x0a }; /* #!AMR\n */

    public static void main(String[] args) throws IOException {
        if (args.length < 2) {
            System.err.println("usage:");
            System.err.println("  java amr.Main dec <in.amr|inDir> <out.pcm|outDir>");
            System.err.println("  java amr.Main bench <in.amr> [<in.amr> ...]");
            System.exit(2);
        }
        String cmd = args[0];
        if (cmd.equals("dec")) {
            File in = new File(args[1]);
            File out = new File(args[2]);
            if (in.isDirectory()) {
                if (!out.isDirectory() && !out.mkdirs()) {
                    System.err.println("cannot create output dir: " + out);
                    System.exit(2);
                }
                File[] files = in.listFiles();
                if (files == null) {
                    System.err.println("cannot list dir: " + in);
                    System.exit(2);
                }
                for (File f : files) {
                    if (f.getName().endsWith(".amr")) {
                        String pcm = f.getName().substring(0, f.getName().length() - 4) + ".pcm";
                        decodeFile(f, new File(out, pcm));
                        System.out.println("decoded " + f.getName() + " -> " + pcm);
                    }
                }
            } else {
                decodeFile(in, out);
                System.out.println("decoded " + in + " -> " + out);
            }
        } else if (cmd.equals("bench")) {
            bench(args, 1);
        } else {
            System.err.println("unknown command: " + cmd);
            System.exit(2);
        }
    }

    static void decodeFile(File in, File out) throws IOException {
        byte[] data = readAll(in);
        AmrNbDecoder dec = new AmrNbDecoder();
        short[] pcm = dec.decodeAll(data);
        FileOutputStream fos = new FileOutputStream(out);
        try {
            byte[] le = new byte[pcm.length * 2];
            for (int i = 0; i < pcm.length; i++) {
                le[i * 2] = (byte) (pcm[i] & 0xff);
                le[i * 2 + 1] = (byte) (pcm[i] >> 8);
            }
            fos.write(le);
        } finally {
            fos.close();
        }
    }

    /** bench(args, argOff): args[argOff..] are .amr files. */
    static void bench(String[] args, int argOff) throws IOException {
        byte[][] datas = new byte[args.length - argOff][];
        long totalFrames = 0;
        for (int i = argOff; i < args.length; i++) {
            datas[i - argOff] = readAll(new File(args[i]));
            int off = isMagic(datas[i - argOff]) ? 6 : 0;
            while (off + 1 <= datas[i - argOff].length) {
                int type = (datas[i - argOff][off] >> 3) & 0x0f;
                int size = FRAME_SIZE[type];
                if (off + size > datas[i - argOff].length) {
                    break;
                }
                off += size;
                totalFrames++;
            }
        }
        final double audioSec = totalFrames * 0.02;

        decodeOnce(datas); /* warmup */
        long best = Long.MAX_VALUE;
        for (int pass = 0; pass < 3; pass++) {
            long t0 = System.nanoTime();
            decodeOnce(datas);
            long ms = (System.nanoTime() - t0) / 1000000;
            if (ms < best) {
                best = ms;
            }
        }

        double rt = audioSec / (best / 1000.0);
        System.out.printf("Java bench: frames=%d audio=%.0fs elapsed=%dms realtime=%.0fx ms/frame=%.3f samples/s=%.0f%n",
            totalFrames, audioSec, best, rt, best / (double) totalFrames,
            totalFrames * 160.0 / (best / 1000.0));
        System.out.printf("::warning title=amr-java-bench::frames=%d audio=%.0fs elapsed=%dms realtime=%.0fx ms/frame=%.3f samples/s=%.0f%n",
            totalFrames, audioSec, best, rt, best / (double) totalFrames,
            totalFrames * 160.0 / (best / 1000.0));
    }

    private static void decodeOnce(byte[][] datas) {
        AmrNbDecoder dec = new AmrNbDecoder();
        byte[] frame = new byte[32];
        short[] pcm = new short[160];
        for (int i = 0; i < datas.length; i++) {
            byte[] data = datas[i];
            int off = isMagic(data) ? 6 : 0;
            while (off + 1 <= data.length) {
                int type = (data[off] >> 3) & 0x0f;
                int size = FRAME_SIZE[type];
                if (off + size > data.length) {
                    break;
                }
                System.arraycopy(data, off, frame, 0, size);
                dec.decode(frame, pcm, 0);
                off += size;
            }
        }
    }

    static boolean isMagic(byte[] data) {
        if (data.length < MAGIC.length) {
            return false;
        }
        for (int i = 0; i < MAGIC.length; i++) {
            if (data[i] != MAGIC[i]) {
                return false;
            }
        }
        return true;
    }

    static byte[] readAll(File f) throws IOException {
        FileInputStream fis = new FileInputStream(f);
        try {
            long len = f.length();
            if (len > Integer.MAX_VALUE) {
                throw new IOException("file too large: " + f);
            }
            byte[] buf = new byte[(int) len];
            int off = 0;
            while (off < buf.length) {
                int n = fis.read(buf, off, buf.length - off);
                if (n < 0) {
                    break;
                }
                off += n;
            }
            return buf;
        } finally {
            fis.close();
        }
    }
}
