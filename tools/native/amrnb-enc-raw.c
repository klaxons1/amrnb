/* Encodes raw Int16LE PCM (8 kHz mono) to IETF .amr using the reference
 * encoder. Mirrors tools/gen-reference.mjs so native and emscripten golden
 * outputs can be cross-checked, and serves as the instrumentation host for
 * encoder divergence bisection.
 * Usage: amrnb-enc-raw in.pcm out.amr mode(0-7) dtx(0|1) */
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <interf_enc.h>

int main(int argc, char *argv[]) {
    FILE *in, *out;
    void *amr;
    int mode, dtx, n, frames = 0;
    int16_t pcm[160];
    uint8_t outbuf[64];

    if (argc < 5) {
        fprintf(stderr, "%s in.pcm out.amr mode(0-7) dtx(0|1)\n", argv[0]);
        return 1;
    }
    mode = atoi(argv[3]);
    dtx = atoi(argv[4]);

    in = fopen(argv[1], "rb");
    if (!in) { perror(argv[1]); return 1; }
    out = fopen(argv[2], "wb");
    if (!out) { perror(argv[2]); fclose(in); return 1; }

    fwrite("#!AMR\n", 1, 6, out);
    amr = Encoder_Interface_init(dtx);
    while ((n = fread(pcm, 2, 160, in)) == 160) {
        int bytes = Encoder_Interface_Encode(amr, (enum Mode)mode, pcm, outbuf, 0);
        fwrite(outbuf, 1, bytes, out);
        frames++;
    }
    Encoder_Interface_exit(amr);
    fclose(out);
    fclose(in);
    fprintf(stderr, "%d frames encoded\n", frames);
    return 0;
}
