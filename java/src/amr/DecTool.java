package amr;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * CLI tool for the Java AMR-NB decoder port (used by java/test.sh).
 *
 * Usage:
 *   java amr.DecTool <in.amr> <out.pcm>       decode one file
 *   java amr.DecTool <inDir> <outDir>         decode every *.amr in a dir
 *
 * Writes raw 16-bit signed little-endian PCM, 8 kHz mono.
 * Handles the IETF storage format with optional "#!AMR\n" magic.
 */
public final class DecTool {
    private DecTool() {}

    static final int[] FRAME_SIZE = {
        13, 14, 16, 18, 20, 21, 27, 32, 6, 1, 1, 1, 1, 1, 1, 1
    };
    static final byte[] MAGIC = { 0x23, 0x21, 0x41, 0x4d, 0x52, 0x0a }; /* #!AMR\n */

    public static void main(String[] args) throws IOException {
        if (args.length != 2) {
            System.err.println("usage: java amr.DecTool <in.amr|inDir> <out.pcm|outDir>");
            System.exit(2);
        }
        File in = new File(args[0]);
        File out = new File(args[1]);
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
    }

    static void decodeFile(File in, File out) throws IOException {
        byte[] data = readAll(in);
        int off = 0;
        if (data.length >= 6 && isMagic(data)) {
            off = 6;
        }
        SpDec.State dec = AmrDecode.Decoder_Interface_init();
        FileOutputStream fos = new FileOutputStream(out);
        try {
            byte[] frame = new byte[32];
            short[] pcm = new short[160];
            byte[] pcmLe = new byte[320];
            while (off + 1 <= data.length) {
                int type = (data[off] >> 3) & 0x0f;
                int size = FRAME_SIZE[type];
                if (off + size > data.length) {
                    break;
                }
                System.arraycopy(data, off, frame, 0, size);
                AmrDecode.Decoder_Interface_Decode(dec, frame, pcm, 0);
                for (int i = 0; i < 160; i++) {
                    pcmLe[i * 2] = (byte) (pcm[i] & 0xff);
                    pcmLe[i * 2 + 1] = (byte) (pcm[i] >> 8);
                }
                fos.write(pcmLe);
                off += size;
            }
        } finally {
            fos.close();
        }
    }

    static boolean isMagic(byte[] data) {
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
