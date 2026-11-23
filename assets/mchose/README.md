# MCHOSE mouse artwork

Official MCHOSE product images, retrieved on 2026-11-23 from the M HUB configuration CDN (`cdn.mchose.com.cn`) and the MCHOSE Shopify store (`mchose.store`). Images remain the property of MCHOSE and are used to identify the supported hardware. These files are not covered by OpenATK's source-code license.

Files are WebP. The store images were cropped to the mouse. Model-to-file mapping is in `images.json`.

| File | Model(s) | Source | Size (px) | Transparent |
| --- | --- | --- | --- | --- |
| `a5v3-pro.webp` | A5 V3 Pro, white | M HUB CDN | 504x952 | yes |
| `a5v3-ultra-plus.webp` | A5 V3 Ultra+, black gold | M HUB CDN | 504x952 | yes |
| `a7v3.webp` | A7 V3, A7 V3 Ultra+ (white) | M HUB CDN | 504x952 | yes |
| `a7v3-pro-plus.webp` | A7 V3 Pro+, white | M HUB CDN | 504x952 | yes |
| `a7v3-x.webp` | A7 V3 X, black | M HUB CDN | 504x952 | yes |
| `k7v2-pro.webp` | K7 V2 Pro, K7 V2 Pro+ (white) | M HUB CDN | 504x952 | yes |
| `k7v2-ultra-plus.webp` | K7 V2 Ultra+, blue gold | M HUB CDN | 504x952 | yes |
| `k5-pro.webp` | K5 Pro, white | M HUB CDN | 504x952 | yes |
| `k5-ultra.webp` | K5 Ultra, white | M HUB CDN | 504x952 | yes |
| `r7-ultra.webp` | R7 Ultra, white | M HUB CDN | 504x952 | yes |
| `v7.webp` | V7, white | M HUB CDN | 504x952 | yes |
| `v7-pro.webp` | V7 Pro, white | M HUB CDN | 504x952 | yes |
| `g3v3.webp` | G3 V3, white | M HUB CDN | 504x952 | yes |
| `g3s.webp` | G3 S, pink | M HUB CDN | 504x952 | yes |
| `l7-ultra.webp` | L7, L7 Pro+, L7 Ultra+, L7 Ultra (white shell) | MCHOSE Shopify store | 708x1344 | no |
| `l7-pro.webp` | L7 Pro, blue | MCHOSE Shopify store | 710x1344 | yes |
| `a7v2-ultra.webp` | A7 V2 Pro, A7 V2 Ultra, A7 V2 Ultra+ (white) | MCHOSE Shopify store | 666x1323 | no |
| `a7x-ultra.webp` | A7X Ultra, white | MCHOSE Shopify store | 685x1349 | no |
| `k7-ultra.webp` | K7 Ultra, white gold | MCHOSE Shopify store | 649x1299 | no |
| `g3-ultra.webp` | G3 Ultra (Dual 8K), white | MCHOSE Shopify store | 648x1170 | no |
| `g3v2-pro.webp` | G3 V2 Pro, white | MCHOSE Shopify store | 644x1168 | no |

Shared files:

- `a5v3-pro.webp` is the same white image as the A5 V3 Ultra+ in white. `images.json` maps A5 V3 Ultra+ to the black gold file instead.
- `a7v3.webp` is also used for the A7 V3 Ultra+ in white.
- `k7v2-pro.webp` is shared by the K7 V2 Pro and K7 V2 Pro+ (white).
- `l7-ultra.webp` is one white shell shared by the L7, L7 Pro+, L7 Ultra+ and L7 Ultra. The L7 Pro has its own blue file, `l7-pro.webp`.
- `a7v2-ultra.webp` is shared by the A7 V2 Pro, A7 V2 Ultra and A7 V2 Ultra+.

Only `l7-pro.webp` has a transparent background. The other store images keep their white background, because keying it out cut into the white shells.

## Mice with no artwork

No usable image was found for these models, so `images.json` has no entry for them:

- M7 family: M7, M7 1K, M7 Pro, M7 Ultra
- A7 (V1), A7 Pro, A7 Ultra, A7 Ultra (RE)
- A5 V2 Ultra, A5 Ultra
- AX5 V2
- K5 V2
- A7 Magnetic
- G3 (plain), G3 A, G3 4K. The G3 Ultra file is the Dual 8K shell and is not used for these.
