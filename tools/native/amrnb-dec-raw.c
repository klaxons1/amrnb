/* Decodes an IETF .amr file to raw Int16LE PCM on stdout-file.
 * Usage: amrnb-dec-raw in.amr out.pcm [bfi_every_N]
 * Mirrors tools/gen-reference.mjs so native and emscripten golden outputs
 * can be cross-checked, and serves as the instrumentation host when
 * bisecting divergences between the C and JS decoders. */
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <interf_dec.h>

static const int block_size[16] = { 13, 14, 16, 18, 20, 21, 27, 32, 6, 1, 1, 1, 1, 1, 1, 1 };

int main(int argc, char *argv[]) {
    FILE *in, *out;
    char header[6];
    int n, frame_no = 0, bfi_every = 0;
    void *amr;

    if (argc < 3) {
        fprintf(stderr, "%s in.amr out.pcm [bfi_every_N]\n", argv[0]);
        return 1;
    }
    if (argc > 3) bfi_every = atoi(argv[3]);

    in = fopen(argv[1], "rb");
    if (!in) { perror(argv[1]); return 1; }
    out = fopen(argv[2], "wb");
    if (!out) { perror(argv[2]); fclose(in); return 1; }

    n = fread(header, 1, 6, in);
    if (n != 6 || memcmp(header, "#!AMR\n", 6)) {
        fprintf(stderr, "Bad header\n");
        return 1;
    }

    amr = Decoder_Interface_init();
    while (1) {
        uint8_t buffer[500];
        int16_t outbuf[160];
        int size, i, bfi;
        /* Read the mode byte */
        n = fread(buffer, 1, 1, in);
        if (n <= 0) break;
        size = block_size[(buffer[0] >> 3) & 0x0f];
        n = fread(buffer + 1, 1, size - 1, in);
        if (n != size - 1) break;

        bfi = (bfi_every > 0 && frame_no > 0 && frame_no % bfi_every == 0) ? 1 : 0;
        Decoder_Interface_Decode(amr, buffer, outbuf, bfi);
        for (i = 0; i < 160; i++) {
            uint8_t b[2];
            b[0] = (uint8_t)(outbuf[i] & 0xff);
            b[1] = (uint8_t)((outbuf[i] >> 8) & 0xff);
            fwrite(b, 1, 2, out);
        }
        frame_no++;
    }
    Decoder_Interface_exit(amr);
    fclose(out);
    fclose(in);
    fprintf(stderr, "%d frames decoded\n", frame_no);
    return 0;
}
