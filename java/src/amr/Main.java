/*
	This file is part of the amrnb project (https://github.com/klaxons1/amrnb):
	a pure Java port of the AMR-NB (narrowband) speech codec.

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.

	This file is a derivative work of the opencore-amr 0.1.6 reference codec
	(https://sourceforge.net/projects/opencore-amr/), original code
	(C) 1998-2010 PacketVideo; portions derived from 3GPP TS 26.073
	(C) 2004 3GPP Organizational Partners.
*/
package amr;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;

import javax.microedition.media.decoders.AMRDecoder;

/*
 * Command-line tool for the Java AMR-NB decoder (used by java/test.sh,
 * also handy standalone):
 *
 *   java amr.Main dec <in.amr|inDir> <out.pcm|outDir>
 *   java amr.Main bench <in.amr> [<in.amr> ...]
 *
 * "dec" writes raw 16-bit signed little-endian PCM, 8 kHz mono.
 * "bench" prints wall-clock timings (3 passes, best of last 3, 1 warmup).
 */
public final class Main
{
	private Main() { }

	/* Frame sizes in bytes (incl. the ToC byte) per frame type, IETF storage format. */
	private static final int[] FRAME_SIZE = { 13, 14, 16, 18, 20, 21, 27, 32, 6, 1, 1, 1, 1, 1, 1, 1 };
	private static final byte[] MAGIC = { 0x23, 0x21, 0x41, 0x4d, 0x52, 0x0a }; /* "#!AMR\n" */

	public static void main(String[] args) throws IOException
	{
		if(args.length < 2)
		{
			System.err.println("usage:");
			System.err.println("  java amr.Main dec <in.amr|inDir> <out.pcm|outDir>");
			System.err.println("  java amr.Main bench <in.amr> [<in.amr> ...]");
			System.exit(2);
		}

		if(args[0].equals("dec"))
		{
			final File in = new File(args[1]);
			final File out = new File(args[2]);
			if(in.isDirectory())
			{
				if(!out.isDirectory() && !out.mkdirs())
				{
					System.err.println("cannot create output dir: " + out);
					System.exit(2);
				}
				final File[] files = in.listFiles();
				if(files == null)
				{
					System.err.println("cannot list dir: " + in);
					System.exit(2);
				}
				for(final File f : files)
				{
					if(f.getName().endsWith(".amr"))
					{
						final String pcm = f.getName().substring(0, f.getName().length() - 4) + ".pcm";
						decodeFile(f, new File(out, pcm));
						System.out.println("decoded " + f.getName() + " -> " + pcm);
					}
				}
			}
			else
			{
				decodeFile(in, out);
				System.out.println("decoded " + in + " -> " + out);
			}
		}
		else if(args[0].equals("bench"))
		{
			bench(args, 1);
		}
		else
		{
			System.err.println("unknown command: " + args[0]);
			System.exit(2);
		}
	}

	/* Decode one .amr file into raw little-endian PCM. */
	static void decodeFile(File in, File out) throws IOException
	{
		final byte[] pcm = AMRDecoder.decodeAMR(readAll(in));
		final FileOutputStream fos = new FileOutputStream(out);
		try
		{
			fos.write(pcm);
		}
		finally
		{
			fos.close();
		}
	}

	/* bench(args, argOff): args[argOff..] are .amr files. */
	static void bench(String[] args, int argOff) throws IOException
	{
		final byte[][] datas = new byte[args.length - argOff][];
		long totalFrames = 0;
		for(int i = argOff; i < args.length; i++)
		{
			datas[i - argOff] = readAll(new File(args[i]));
			final int off = isMagic(datas[i - argOff]) ? MAGIC.length : 0;
			int p = off;
			while(p + 1 <= datas[i - argOff].length)
			{
				final int size = FRAME_SIZE[(datas[i - argOff][p] >> 3) & 0x0f];
				if(p + size > datas[i - argOff].length) { break; }
				p += size;
				totalFrames++;
			}
		}
		final double audioSec = totalFrames * 0.02;

		decodeOnce(datas); /* warmup */
		long best = Long.MAX_VALUE;
		for(int pass = 0; pass < 3; pass++)
		{
			final long t0 = System.nanoTime();
			decodeOnce(datas);
			final long ms = (System.nanoTime() - t0) / 1000000;
			if(ms < best) { best = ms; }
		}

		final double rt = audioSec / (best / 1000.0);
		System.out.printf("Java bench: frames=%d audio=%.0fs elapsed=%dms realtime=%.0fx ms/frame=%.3f samples/s=%.0f%n",
			totalFrames, audioSec, best, rt, best / (double) totalFrames,
			totalFrames * 160.0 / (best / 1000.0));
		System.out.printf("::warning title=amr-java-bench::frames=%d audio=%.0fs elapsed=%dms realtime=%.0fx ms/frame=%.3f samples/s=%.0f%n",
			totalFrames, audioSec, best, rt, best / (double) totalFrames,
			totalFrames * 160.0 / (best / 1000.0));
	}

	private static void decodeOnce(byte[][] datas)
	{
		for(int i = 0; i < datas.length; i++)
		{
			AMRDecoder.decodeAMR(datas[i]);
		}
	}

	static boolean isMagic(byte[] data)
	{
		if(data.length < MAGIC.length) { return false; }
		for(int i = 0; i < MAGIC.length; i++)
		{
			if(data[i] != MAGIC[i]) { return false; }
		}
		return true;
	}

	static byte[] readAll(File f) throws IOException
	{
		final FileInputStream fis = new FileInputStream(f);
		try
		{
			final long len = f.length();
			if(len > Integer.MAX_VALUE)
			{
				throw new IOException("file too large: " + f);
			}
			final byte[] buf = new byte[(int) len];
			int off = 0;
			while(off < buf.length)
			{
				final int n = fis.read(buf, off, buf.length - off);
				if(n < 0) { break; }
				off += n;
			}
			return buf;
		}
		finally
		{
			fis.close();
		}
	}
}
