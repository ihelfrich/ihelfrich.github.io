# Color migration report (2026-09-17)

Files scanned: 108. Replacements by kind: {"role":204,"primitive":1120,"alpha":456,"skipped":80,"fallback":63}. Primitives after migration: 408 (402 migrated + 6 brand).

Tolerance: literals within ΔE ≤ 2 (CIE76) of an existing primitive reuse it. No visible change is intended by this pass.

## Proposed consolidations. Not applied; merging is a visible design decision for Dr. Helfrich.

### ΔE ≤ 4: 402 primitives would become 233

| Keep (most used) | Uses | Would absorb |
| --- | --- | --- |
| --p-neutral-95 `#f4f1e9` | 94 | --p-neutral-97b `#fff5ef` ×1, --p-neutral-95d `#f6eeeb` ×1, --p-neutral-95g `#edf1e9` ×5, --p-neutral-93 `#f2eade` ×36 |
| --p-neutral-08b `#171717` | 66 | --p-neutral-10 `#171c1e` ×1, --p-neutral-05 `#111111` ×2, --p-neutral-09b `#1b1a18` ×5, --p-neutral-08 `#161915` ×6, --p-neutral-08c `#121819` ×9 |
| --p-neutral-58 `#8f8b84` | 40 | --p-neutral-61 `#96928c` ×10 |
| --p-neutral-00 `#000000` | 23 | --p-neutral-03 `#09090b` ×4 |
| --p-neutral-68 `#aaa6a0` | 22 | --p-neutral-70 `#aaaaaa` ×14 |
| --p-neutral-37b `#5b5751` | 21 | --p-neutral-35 `#55524e` ×8 |
| --p-neutral-98 `#f9f9f9` | 21 | --p-neutral-96c `#edf5f3` ×1, --p-neutral-97 `#f4f7fb` ×5, --p-neutral-99 `#fffdf7` ×6, --p-neutral-95e `#edf3f5` ×7 |
| --p-blue-16 `#102a43` | 17 | --p-blue-17 `#142b49` ×2 |
| --p-neutral-75 `#bdb8b0` | 16 | --p-neutral-77 `#c7bdb0` ×3, --p-neutral-77b `#c3bfb7` ×9 |
| --p-blue-89b `#c8e6ee` | 16 | --p-blue-88b `#c0e3ed` ×1, --p-blue-86c `#c1dce7` ×2, --p-blue-91 `#d0e8f3` ×4 |
| --p-neutral-36 `#555555` | 15 | --p-neutral-34 `#4f4f4f` ×1 |
| --p-neutral-43 `#666666` | 15 | --p-neutral-45b `#6b6b6b` ×4, --p-neutral-41 `#606060` ×5, --p-neutral-42b `#66625d` ×9 |
| --p-neutral-49 `#7a746b` | 15 | --p-neutral-53 `#817d76` ×2, --p-neutral-47 `#757069` ×10 |
| --p-neutral-76b `#bbbbbb` | 15 | --p-neutral-78b `#c1c1c1` ×1, --p-neutral-76e `#b9bdba` ×1, --p-neutral-75b `#b7b7bd` ×2, --p-neutral-74 `#b5b5b5` ×2 |
| --p-blue-80c `#9ecded` | 15 | --p-blue-80 `#a0ceea` ×1, --p-blue-83b `#a7d4f0` ×2 |
| --p-neutral-50 `#777777` | 13 | --p-neutral-48 `#717171` ×3, --p-neutral-52 `#7d7d7d` ×6 |
| --p-gold-80 `#e4c18a` | 13 | --p-gold-81c `#e5c486` ×1, --p-gold-79b `#dec08e` ×2, --p-gold-77 `#dabb86` ×2, --p-gold-82 `#eac88f` ×4 |
| --p-blue-75 `#a7bcc6` | 12 | --p-blue-76c `#a5bece` ×1, --p-blue-78b `#abc5d0` ×4, --p-blue-76b `#aebfcb` ×6, --p-blue-79 `#b4c6d0` ×9 |
| --p-neutral-79 `#b8c6bf` | 12 | --p-neutral-80b `#bfc9be` ×1, --p-green-78 `#b5c6ba` ×1, --p-teal-77b `#abc3bc` ×1, --p-neutral-78c `#b7c5c5` ×2, --p-neutral-76c `#aebfb9` ×2, --p-neutral-77d `#b9c1ba` ×3 |
| --p-neutral-81 `#c8c8c8` | 11 | --p-neutral-83c `#c9d0ce` ×1, --p-neutral-81b `#c9c9ce` ×1 |
| --p-neutral-09c `#101c22` | 10 | --p-blue-10 `#101c25` ×1, --p-neutral-09d `#111b1d` ×1, --p-blue-12b `#12212a` ×4, --p-neutral-13b `#192329` ×5 |
| --p-neutral-93d `#ececec` | 10 | --p-neutral-91b `#e4e4e1` ×1, --p-neutral-92 `#e3e8e4` ×3, --p-neutral-93e `#e3ebef` ×4 |
| --p-neutral-12 `#1b2123` | 9 | --p-neutral-13 `#212121` ×2, --p-neutral-13c `#172322` ×2, --p-neutral-11 `#142021` ×3, --p-neutral-14 `#1b2528` ×6 |
| --p-blue-69 `#aa9bff` | 9 | --p-violet-71 `#b3a0ff` ×4 |
| --p-neutral-85 `#d4d4d4` | 9 | --p-neutral-88c `#dedede` ×2, --p-neutral-87 `#d9d9d7` ×3 |
| --p-neutral-91 `#d9e7ef` | 8 | --p-neutral-88d `#d0deea` ×1, --p-neutral-90b `#dae4e9` ×4, --p-neutral-93f `#dfedf3` ×5, --p-neutral-89b `#d4e0e8` ×5 |
| --p-red-46b `#b54f2d` | 7 | --p-red-47 `#bb4e30` ×1 |
| --p-gold-79 `#e5bd77` | 7 | --p-gold-79e `#e0bf77` ×2 |
| --p-blue-79e `#aec9d8` | 7 | --p-blue-82b `#b8d1de` ×1, --p-blue-81b `#b9cdd7` ×1, --p-blue-79d `#a6c9da` ×1, --p-blue-82 `#b8cfe2` ×2 |
| --p-blue-08 `#171525` | 6 | --p-blue-06 `#10121f` ×2, --p-blue-07 `#121426` ×4 |
| --p-neutral-31 `#4c4945` | 6 | --p-neutral-28 `#45423e` ×1, --p-neutral-29 `#444444` ×2 |
| --p-neutral-73 `#a8b8b0` | 6 | --p-neutral-70b `#9eafab` ×1, --p-neutral-74b `#aeb9b2` ×2 |
| --p-neutral-82b `#bfced6` | 6 | --p-blue-84d `#c0d4df` ×1, --p-neutral-83d `#c7d1d6` ×1, --p-neutral-82c `#c1cecf` ×1, --p-neutral-80 `#bdc8ce` ×3, --p-neutral-84b `#c5d2dc` ×5 |
| --p-blue-86b `#b8dce8` | 6 | --p-blue-84e `#b8d6e4` ×4 |
| --p-neutral-94 `#e8eefb` | 6 | --p-neutral-96b `#edf4ff` ×2, --p-blue-94 `#e9edff` ×2, --p-neutral-95b `#f0f0ff` ×3, --p-neutral-93b `#edebf4` ×4, --p-neutral-95c `#eaf0f8` ×5 |
| --p-neutral-84 `#d7d2ca` | 5 | --p-neutral-83b `#d6cec3` ×1, --p-neutral-82 `#d0cbc3` ×1, --p-neutral-86c `#d6d9d1` ×2 |
| --p-neutral-04 `#071014` | 4 | --p-neutral-05b `#061313` ×1, --p-neutral-06 `#0f1519` ×2 |
| --p-neutral-21 `#333333` | 4 | --p-neutral-20 `#33312e` ×1, --p-neutral-24 `#3a3a3a` ×2, --p-neutral-23 `#393733` ×2 |
| --p-neutral-49b `#73737b` | 4 | --p-neutral-49c `#777480` ×4 |
| --p-blue-68b `#91a8b9` | 4 | --p-blue-69c `#93acb9` ×1, --p-blue-67b `#92a7b2` ×1 |
| --p-gold-69 `#d3a14a` | 4 | --p-gold-72 `#d6a954` ×1 |
| --p-neutral-72 `#aab3b2` | 4 | --p-neutral-69c `#9faaab` ×1 |
| --p-neutral-77c `#b4c2c6` | 4 | --p-neutral-76d `#acc0c2` ×1 |
| --p-neutral-86 `#cfdae3` | 4 | --p-neutral-87b `#d2dce1` ×1, --p-neutral-86b `#c9dae3` ×1 |
| --p-neutral-88 `#d6ded9` | 4 | --p-neutral-89c `#dde0d9` ×3 |
| --p-neutral-26 `#3a3f39` | 3 | --p-neutral-26b `#403d39` ×1 |
| --p-neutral-44 `#686870` | 3 | --p-neutral-42 `#66636a` ×2 |
| --p-blue-46b `#5a6f7c` | 3 | --p-blue-47 `#60717c` ×1 |
| --p-blue-69b `#aaa6c1` | 3 | --p-blue-67 `#a1a1b8` ×1 |
| --p-gold-75b `#cfb681` | 3 | --p-gold-74b `#cab383` ×2 |
| --p-gold-79d `#d7c08f` | 3 | --p-gold-81d `#dfc79a` ×1, --p-gold-81 `#e2c696` ×1 |
| --p-gold-80b `#d8c6a1` | 3 | --p-gold-81e `#ddc79f` ×1, --p-gold-81b `#e1c69f` ×2 |
| --p-neutral-83 `#c5d0ca` | 3 | --p-neutral-82d `#c9cfc6` ×1 |
| --p-neutral-85b `#d6d4de` | 3 | --p-neutral-89 `#dedee5` ×1, --p-neutral-88b `#dedbe5` ×1, --p-violet-84 `#d3cedd` ×2 |
| --p-gold-87c `#f1d69f` | 3 | --p-gold-86 `#ecd79e` ×2 |
| --p-blue-89 `#e1deee` | 3 | --p-violet-92 `#eae6f6` ×3 |
| --p-neutral-90 `#e8e1d7` | 3 | --p-neutral-92b `#e6e8df` ×1 |
| --p-blue-95 `#f1edff` | 3 | --p-blue-93 `#ebe7ff` ×2 |
| --p-blue-17b `#252944` | 2 | --p-blue-18b `#262b42` ×1 |
| --p-teal-24 `#293d3f` | 2 | --p-neutral-25 `#313d3c` ×1 |
| --p-neutral-62b `#969696` | 2 | --p-neutral-65 `#9d9d9d` ×1 |
| --p-neutral-62c `#8e9999` | 2 | --p-neutral-59b `#829192` ×1 |
| --p-neutral-69 `#a8a8ae` | 2 | --p-neutral-69b `#aaa6b0` ×1 |
| --p-blue-73 `#b5b1c8` | 2 | --p-violet-75 `#bdb4d0` ×1, --p-blue-72 `#aeafc2` ×1 |
| --p-blue-75c `#9bbdd4` | 2 | --p-blue-79f `#a7c7dd` ×1, --p-blue-75b `#91bfda` ×1, --p-blue-74b `#8fbdd3` ×1 |
| --p-neutral-76 `#bbb9c2` | 2 | --p-neutral-78 `#c2bec6` ×1 |
| --p-blue-84 `#c7d2e2` | 2 | --p-blue-84b `#c2d2e6` ×1 |
| --p-blue-14 `#232231` | 1 | --p-blue-15 `#222536` ×1 |
| --p-neutral-17b `#202b2a` | 1 | --p-neutral-17 `#222b2f` ×1 |
| --p-neutral-20e `#27332e` | 1 | --p-neutral-20d `#2a3332` ×1 |
| --p-neutral-20c `#273337` | 1 | --p-neutral-20b `#26333b` ×1 |
| --p-violet-29 `#494254` | 1 | --p-violet-32 `#51495d` ×1 |
| --p-violet-34 `#594782` | 1 | --p-violet-36 `#574b86` ×1 |
| --p-neutral-36b `#55525d` | 1 | --p-neutral-37 `#575761` ×1 |
| --p-neutral-40 `#536064` | 1 | --p-neutral-42c `#58656a` ×1, --p-blue-40 `#53616b` ×1 |
| --p-neutral-42d `#586761` | 1 | --p-teal-43 `#536965` ×1 |
| --p-blue-49 `#667880` | 1 | --p-blue-52 `#667f86` ×1 |
| --p-neutral-49d `#6e7872` | 1 | --p-neutral-52b `#777e77` ×1, --p-neutral-51 `#757c71` ×1 |
| --p-blue-54 `#6c8591` | 1 | --p-blue-55b `#6d8799` ×1 |
| --p-blue-55 `#7d829d` | 1 | --p-blue-57 `#85889e` ×1 |
| --p-neutral-59 `#8d8d94` | 1 | --p-neutral-62 `#99939a` ×1 |
| --p-gold-71b `#c1aa80` | 1 | --p-gold-72b `#c6af83` ×1 |
| --p-blue-76 `#bdb0ff` | 1 | --p-blue-77c `#c3b6ff` ×1 |
| --p-teal-76 `#7bc9d3` | 1 | --p-teal-77 `#77cbd3` ×1 |
| --p-violet-81 `#ccc7d8` | 1 | --p-violet-83 `#d1cbdf` ×1 |
| --p-teal-82 `#a2d7bc` | 1 | --p-teal-83d `#9fddbf` ×1 |
| --p-teal-83b `#b7d6ce` | 1 | --p-teal-84 `#b9d8d5` ×1 |
| --p-blue-84c `#b2d6ec` | 1 | --p-blue-85b `#b9d8ec` ×1 |
| --p-gold-85 `#e9d2b4` | 1 | --p-gold-87b `#e9d8b9` ×1 |
| --p-blue-86 `#d7d2f3` | 1 | --p-violet-88 `#e0d8f8` ×1 |
| --p-neutral-93c `#f7e8df` | 1 | --p-neutral-96 `#fff0e8` ×1, --p-red-94 `#ffe8e2` ×1 |
| --p-gold-94 `#f5eedc` | 1 | --p-gold-96 `#fff1dc` ×1, --p-green-94 `#eef0e0` ×1 |

### ΔE ≤ 6: 402 primitives would become 158

| Keep (most used) | Uses | Would absorb |
| --- | --- | --- |
| --p-neutral-95 `#f4f1e9` | 94 | --p-neutral-97b `#fff5ef` ×1, --p-neutral-96c `#edf5f3` ×1, --p-neutral-96 `#fff0e8` ×1, --p-neutral-95d `#f6eeeb` ×1, --p-green-94 `#eef0e0` ×1, --p-gold-94 `#f5eedc` ×1, --p-neutral-93c `#f7e8df` ×1, --p-neutral-92b `#e6e8df` ×1, --p-neutral-91b `#e4e4e1` ×1, --p-neutral-90c `#e0e4d9` ×1, --p-neutral-92 `#e3e8e4` ×3, --p-neutral-90 `#e8e1d7` ×3, --p-neutral-95g `#edf1e9` ×5, --p-neutral-99 `#fffdf7` ×6, --p-neutral-93d `#ececec` ×10, --p-neutral-98 `#f9f9f9` ×21, --p-neutral-93 `#f2eade` ×36 |
| --p-neutral-08b `#171717` | 66 | --p-neutral-10 `#171c1e` ×1, --p-neutral-09d `#111b1d` ×1, --p-neutral-05b `#061313` ×1, --p-neutral-13 `#212121` ×2, --p-neutral-06 `#0f1519` ×2, --p-neutral-05 `#111111` ×2, --p-neutral-04 `#071014` ×4, --p-neutral-03 `#09090b` ×4, --p-neutral-09b `#1b1a18` ×5, --p-neutral-08 `#161915` ×6, --p-neutral-12 `#1b2123` ×9, --p-neutral-08c `#121819` ×9 |
| --p-gold-84 `#f3cc78` | 44 | --p-gold-78b `#e0bd68` ×5 |
| --p-neutral-58 `#8f8b84` | 40 | --p-neutral-62b `#969696` ×2, --p-neutral-55 `#848484` ×2, --p-neutral-53 `#817d76` ×2, --p-neutral-61 `#96928c` ×10, --p-neutral-63 `#9b978f` ×12 |
| --p-neutral-68 `#aaa6a0` | 22 | --p-neutral-68b `#9ea9a3` ×1, --p-neutral-65 `#9d9d9d` ×1, --p-neutral-70 `#aaaaaa` ×14 |
| --p-neutral-37b `#5b5751` | 21 | --p-neutral-34 `#4f4f4f` ×1, --p-neutral-41 `#606060` ×5, --p-neutral-35 `#55524e` ×8, --p-neutral-42b `#66625d` ×9, --p-neutral-36 `#555555` ×15 |
| --p-blue-16 `#102a43` | 17 | --p-blue-17 `#142b49` ×2, --p-blue-12 `#0c2235` ×8 |
| --p-neutral-75 `#bdb8b0` | 16 | --p-neutral-78b `#c1c1c1` ×1, --p-neutral-76e `#b9bdba` ×1, --p-green-76 `#b6beb0` ×1, --p-gold-73 `#b9b2a3` ×1, --p-neutral-74 `#b5b5b5` ×2, --p-neutral-77d `#b9c1ba` ×3, --p-neutral-77 `#c7bdb0` ×3, --p-gold-78 `#c9c0af` ×4, --p-neutral-77b `#c3bfb7` ×9, --p-neutral-76b `#bbbbbb` ×15 |
| --p-blue-89b `#c8e6ee` | 16 | --p-blue-88b `#c0e3ed` ×1, --p-neutral-86b `#c9dae3` ×1, --p-blue-93b `#d6edfc` ×2, --p-blue-86c `#c1dce7` ×2, --p-blue-91 `#d0e8f3` ×4, --p-blue-86b `#b8dce8` ×6, --p-neutral-91 `#d9e7ef` ×8 |
| --p-neutral-43 `#666666` | 15 | --p-neutral-42 `#66636a` ×2, --p-neutral-48 `#717171` ×3, --p-neutral-45 `#6a6c64` ×3, --p-neutral-44 `#686870` ×3, --p-neutral-45b `#6b6b6b` ×4 |
| --p-neutral-49 `#7a746b` | 15 | --p-neutral-51 `#757c71` ×1, --p-neutral-47 `#757069` ×10, --p-neutral-50 `#777777` ×13 |
| --p-blue-80c `#9ecded` | 15 | --p-blue-80 `#a0ceea` ×1, --p-blue-75b `#91bfda` ×1, --p-blue-83b `#a7d4f0` ×2, --p-blue-80b `#a9c9e4` ×2 |
| --p-gold-80 `#e4c18a` | 13 | --p-gold-81f `#e7c596` ×1, --p-gold-81 `#e2c696` ×1, --p-gold-81c `#e5c486` ×1, --p-gold-79c `#dcc080` ×1, --p-gold-79b `#dec08e` ×2, --p-gold-77 `#dabb86` ×2, --p-gold-75 `#d5b578` ×2, --p-gold-82 `#eac88f` ×4 |
| --p-blue-75 `#a7bcc6` | 12 | --p-neutral-76d `#acc0c2` ×1, --p-blue-76c `#a5bece` ×1, --p-blue-71b `#9db1bc` ×1, --p-blue-79b `#abc9d0` ×2, --p-blue-78b `#abc5d0` ×4, --p-neutral-77c `#b4c2c6` ×4, --p-blue-76b `#aebfcb` ×6, --p-blue-79e `#aec9d8` ×7, --p-blue-79 `#b4c6d0` ×9 |
| --p-neutral-79 `#b8c6bf` | 12 | --p-neutral-83c `#c9d0ce` ×1, --p-neutral-82d `#c9cfc6` ×1, --p-neutral-82c `#c1cecf` ×1, --p-neutral-80b `#bfc9be` ×1, --p-green-78 `#b5c6ba` ×1, --p-teal-77b `#abc3bc` ×1, --p-neutral-78c `#b7c5c5` ×2, --p-neutral-76c `#aebfb9` ×2, --p-neutral-74b `#aeb9b2` ×2, --p-neutral-83 `#c5d0ca` ×3, --p-neutral-73 `#a8b8b0` ×6 |
| --p-neutral-81 `#c8c8c8` | 11 | --p-neutral-83d `#c7d1d6` ×1, --p-neutral-82 `#d0cbc3` ×1, --p-neutral-81b `#c9c9ce` ×1, --p-neutral-81c `#cbc7d0` ×1, --p-neutral-78 `#c2bec6` ×1, --p-neutral-80 `#bdc8ce` ×3, --p-neutral-84 `#d7d2ca` ×5, --p-neutral-85 `#d4d4d4` ×9 |
| --p-neutral-09c `#101c22` | 10 | --p-blue-14b `#15262e` ×1, --p-blue-10 `#101c25` ×1, --p-neutral-10c `#101d1c` ×1, --p-neutral-11 `#142021` ×3, --p-blue-12b `#12212a` ×4, --p-neutral-13b `#192329` ×5, --p-neutral-14 `#1b2528` ×6 |
| --p-teal-11 `#0a211e` | 9 | --p-neutral-13c `#172322` ×2 |
| --p-blue-42 `#2852e8` | 9 | --p-violet-43 `#4b4fe9` ×2 |
| --p-blue-69 `#aa9bff` | 9 | --p-violet-71 `#b3a0ff` ×4 |
| --p-red-46b `#b54f2d` | 7 | --p-red-50 `#bf5a3c` ×1, --p-red-47 `#bb4e30` ×1, --p-red-46 `#ad5127` ×1 |
| --p-gold-79 `#e5bd77` | 7 | --p-gold-83c `#edca86` ×1, --p-gold-79e `#e0bf77` ×2 |
| --p-neutral-95e `#edf3f5` | 7 | --p-neutral-95f `#e6f4fc` ×1, --p-neutral-96b `#edf4ff` ×2, --p-neutral-93b `#edebf4` ×4, --p-neutral-93e `#e3ebef` ×4, --p-neutral-90b `#dae4e9` ×4, --p-neutral-97 `#f4f7fb` ×5, --p-neutral-95c `#eaf0f8` ×5, --p-neutral-93f `#dfedf3` ×5, --p-neutral-94 `#e8eefb` ×6 |
| --p-blue-08 `#171525` | 6 | --p-violet-10 `#21182c` ×1, --p-neutral-09 `#191923` ×2, --p-blue-07b `#0c1724` ×2, --p-blue-06 `#10121f` ×2, --p-blue-07 `#121426` ×4 |
| --p-neutral-31 `#4c4945` | 6 | --p-neutral-28 `#45423e` ×1, --p-neutral-26b `#403d39` ×1, --p-neutral-29 `#444444` ×2 |
| --p-neutral-52 `#7d7d7d` | 6 | --p-neutral-52b `#777e77` ×1, --p-neutral-49b `#73737b` ×4 |
| --p-neutral-82b `#bfced6` | 6 | --p-neutral-87b `#d2dce1` ×1, --p-blue-84d `#c0d4df` ×1, --p-blue-82b `#b8d1de` ×1, --p-blue-81b `#b9cdd7` ×1, --p-blue-84 `#c7d2e2` ×2, --p-neutral-86 `#cfdae3` ×4, --p-neutral-84b `#c5d2dc` ×5 |
| --p-teal-41b `#176b6a` | 5 | --p-teal-41 `#126d65` ×1 |
| --p-violet-74 `#bcaaff` | 5 | --p-blue-76 `#bdb0ff` ×1 |
| --p-neutral-89b `#d4e0e8` | 5 | --p-blue-90 `#d7e3f6` ×1, --p-neutral-89 `#dedee5` ×1, --p-neutral-88b `#dedbe5` ×1, --p-neutral-88d `#d0deea` ×1, --p-neutral-88c `#dedede` ×2, --p-neutral-85b `#d6d4de` ×3 |
| --p-neutral-21 `#333333` | 4 | --p-neutral-20 `#33312e` ×1, --p-neutral-20d `#2a3332` ×1, --p-neutral-20c `#273337` ×1, --p-neutral-24 `#3a3a3a` ×2, --p-neutral-23 `#393733` ×2 |
| --p-red-45 `#ad4e35` | 4 | --p-red-42 `#a24828` ×1 |
| --p-blue-68b `#91a8b9` | 4 | --p-blue-69c `#93acb9` ×1, --p-blue-67b `#92a7b2` ×1 |
| --p-gold-69 `#d3a14a` | 4 | --p-gold-72 `#d6a954` ×1 |
| --p-neutral-72 `#aab3b2` | 4 | --p-neutral-70b `#9eafab` ×1, --p-neutral-69c `#9faaab` ×1, --p-neutral-75b `#b7b7bd` ×2 |
| --p-blue-74 `#9cb3ff` | 4 | --p-blue-68 `#86a5f2` ×2 |
| --p-blue-84e `#b8d6e4` | 4 | --p-blue-85b `#b9d8ec` ×1, --p-blue-84c `#b2d6ec` ×1, --p-blue-84b `#c2d2e6` ×1, --p-blue-79d `#a6c9da` ×1, --p-blue-82 `#b8cfe2` ×2 |
| --p-neutral-88 `#d6ded9` | 4 | --p-neutral-86c `#d6d9d1` ×2, --p-neutral-89c `#dde0d9` ×3, --p-neutral-87 `#d9d9d7` ×3 |
| --p-neutral-26 `#3a3f39` | 3 | --p-neutral-25 `#313d3c` ×1 |
| --p-blue-46b `#5a6f7c` | 3 | --p-blue-49 `#667880` ×1, --p-blue-47 `#60717c` ×1, --p-blue-40 `#53616b` ×1 |
| --p-blue-69b `#aaa6c1` | 3 | --p-violet-75 `#bdb4d0` ×1, --p-blue-72 `#aeafc2` ×1, --p-violet-72 `#b7abc9` ×1, --p-blue-67 `#a1a1b8` ×1, --p-blue-73 `#b5b1c8` ×2 |
| --p-gold-71 `#d5a63b` | 3 | --p-gold-74 `#e4ae4a` ×1 |
| --p-gold-75b `#cfb681` | 3 | --p-gold-72b `#c6af83` ×1, --p-gold-70 `#c5a774` ×1, --p-gold-74b `#cab383` ×2, --p-gold-79d `#d7c08f` ×3 |
| --p-gold-80b `#d8c6a1` | 3 | --p-gold-81d `#dfc79a` ×1, --p-gold-81e `#ddc79f` ×1, --p-gold-81b `#e1c69f` ×2 |
| --p-red-81 `#ffb7a4` | 3 | --p-red-78 `#efb49d` ×1 |
| --p-green-86b `#b4e1c8` | 3 | --p-teal-82 `#a2d7bc` ×1 |
| --p-gold-87c `#f1d69f` | 3 | --p-gold-87 `#f0d6aa` ×1, --p-gold-86 `#ecd79e` ×2 |
| --p-blue-87 `#badfff` | 3 | --p-blue-88 `#caddff` ×1 |
| --p-blue-89 `#e1deee` | 3 | --p-blue-92 `#e4e5ff` ×1, --p-blue-85 `#d6d3e7` ×1, --p-blue-94 `#e9edff` ×2, --p-blue-93 `#ebe7ff` ×2, --p-violet-84 `#d3cedd` ×2, --p-blue-95 `#f1edff` ×3, --p-violet-92 `#eae6f6` ×3 |
| --p-blue-17b `#252944` | 2 | --p-blue-18b `#262b42` ×1, --p-blue-18 `#272a3e` ×1 |
| --p-blue-21 `#30313d` | 2 | --p-neutral-20b `#26333b` ×1 |
| --p-violet-40 `#615a73` | 2 | --p-violet-39 `#645777` ×1 |
| --p-violet-42b `#64606e` | 2 | --p-neutral-37 `#575761` ×1 |
| --p-neutral-62c `#8e9999` | 2 | --p-neutral-59b `#829192` ×1 |
| --p-neutral-69 `#a8a8ae` | 2 | --p-neutral-69b `#aaa6b0` ×1 |
| --p-blue-75c `#9bbdd4` | 2 | --p-blue-79c `#9fcadd` ×1, --p-blue-79f `#a7c7dd` ×1, --p-blue-74b `#8fbdd3` ×1 |
| --p-neutral-76 `#bbb9c2` | 2 | --p-blue-77b `#bcbccd` ×2 |
| --p-teal-76b `#83c7ca` | 2 | --p-teal-77 `#77cbd3` ×1, --p-teal-76 `#7bc9d3` ×1 |
| --p-blue-78 `#b9c0d8` | 2 | --p-violet-78 `#c4bed5` ×1 |
| --p-blue-14 `#232231` | 1 | --p-blue-15 `#222536` ×1 |
| --p-neutral-15 `#222822` | 1 | --p-neutral-20e `#27332e` ×1, --p-neutral-17b `#202b2a` ×1 |
| --p-violet-29 `#494254` | 1 | --p-violet-32 `#51495d` ×1 |
| --p-violet-34 `#594782` | 1 | --p-violet-36 `#574b86` ×1 |
| --p-teal-36 `#485952` | 1 | --p-teal-39 `#426158` ×1 |
| --p-neutral-40 `#536064` | 1 | --p-neutral-42c `#58656a` ×1 |
| --p-neutral-42d `#586761` | 1 | --p-neutral-46 `#60716f` ×1, --p-teal-43 `#536965` ×1 |
| --p-blue-51 `#5e7e93` | 1 | --p-blue-55b `#6d8799` ×1 |
| --p-blue-52 `#667f86` | 1 | --p-blue-54 `#6c8591` ×1 |
| --p-blue-55 `#7d829d` | 1 | --p-blue-57 `#85889e` ×1 |
| --p-neutral-59 `#8d8d94` | 1 | --p-neutral-62 `#99939a` ×1 |
| --p-violet-81 `#ccc7d8` | 1 | --p-violet-83 `#d1cbdf` ×1 |
| --p-teal-82c `#a7d3d5` | 1 | --p-teal-87 `#b4e3e5` ×1, --p-teal-84 `#b9d8d5` ×1, --p-teal-83c `#aad8d3` ×1 |
| --p-green-82 `#bed2c3` | 1 | --p-teal-83b `#b7d6ce` ×1 |
| --p-teal-83d `#9fddbf` | 1 | --p-green-86 `#a7e4c2` ×1 |
| --p-gold-85 `#e9d2b4` | 1 | --p-gold-87b `#e9d8b9` ×1 |
| --p-blue-86 `#d7d2f3` | 1 | --p-violet-88 `#e0d8f8` ×1 |

## Skipped: literals outside `<style>` (scripts, SVG attributes, inline styles)

- src/components/CounterfactualAtlas.astro: `#0f302a`
- src/components/CounterfactualAtlas.astro: `#184139`
- src/components/CounterfactualAtlas.astro: `#f7f2e9`
- src/components/CounterfactualAtlas.astro: `#a8b8b0`
- src/components/CounterfactualAtlas.astro: `#f15a37`
- src/components/CounterfactualAtlas.astro: `#78a7a0`
- src/components/CounterfactualAtlas.astro: `#e0bd68`
- src/components/CounterfactualAtlas.astro: `#a9361f`
- src/components/CounterfactualAtlas.astro: `#426158`
- src/components/CounterfactualAtlas.astro: `#fffdf7`
- src/components/EvidenceTransects.astro: `#6a6c64`
- src/components/EvidenceTransects.astro: `#78a7a0`
- src/components/EvidenceTransects.astro: `#e0bd68`
- src/components/EvidenceTransects.astro: `#f15a37`
- src/components/EvidenceTransects.astro: `#f5f0e6`
- src/components/EvidenceTransects.astro: `#161915`
- src/components/EvidenceTransects.astro: `#3a3f39`
- src/components/EvidenceTransects.astro: `#a9361f`
- src/components/EvidenceTransects.astro: `#f15a37`
- src/components/EvidenceTransects.astro: `#f15a37`
- src/components/EvidenceTransects.astro: `#f7f2e9`
- src/components/FieldSignatures.astro: `#d5a63b`
- src/components/FieldSignatures.astro: `#d5a63b`
- src/components/FieldSignatures.astro: `#b54f2d`
- src/components/LiveCapabilityField.astro: `#2e6bff`
- src/components/LiveCapabilityField.astro: `#2e6bff`
- src/components/LiveCapabilityField.astro: `#6f6a61`
- src/components/LiveCapabilityField.astro: `#1b1a18`
- src/components/LiveCapabilityField.astro: `#2e6bff`
- src/components/LiveCapabilityField.astro: `#4e4a43`
- src/components/ProofCircuit.astro: `#c9c0af`
- src/components/ProofCircuit.astro: `#78a7a0`
- src/components/ProofCircuit.astro: `#f15a37`
- src/components/econometrics/MeasurementLab.astro: `#6845b7`
- src/components/econometrics/MeasurementLab.astro: `#142b49`
- src/components/econometrics/MeasurementLab.astro: `#c7d2e2`
- src/components/econometrics/MeasurementLab.astro: `#506379`
- src/components/econometrics/MeasurementLab.astro: `#142b49`
- src/components/econometrics/MeasurementLab.astro: `#506379`
- src/components/econometrics/MeasurementLab.astro: `#eae6f6`
- src/components/econometrics/MeasurementLab.astro: `#6845b7`
- src/components/econometrics/MeasurementLab.astro: `#142b49`
- src/components/econometrics/MeasurementLab.astro: `#2459d3`
- src/components/econometrics/MeasurementLab.astro: `#c7d2e2`
- src/components/econometrics/MeasurementLab.astro: `#2459d3`
- src/components/econometrics/MeasurementLab.astro: `#2459d3`
- src/components/econometrics/MeasurementLab.astro: `#2459d3`
- src/components/econometrics/MeasurementLab.astro: `#2459d3`
- src/components/econometrics/MeasurementLab.astro: `#2459d3`
- src/components/econometrics/MeasurementLab.astro: `#506379`
- src/components/econometrics/MeasurementLab.astro: `#142b49`
- src/components/econometrics/MeasurementLab.astro: `#506379`
- src/components/econometrics/MeasurementLab.astro: `#506379`
- src/components/econometrics/MeasurementLab.astro: `#c7d2e2`
- src/components/econometrics/MeasurementLab.astro: `#c7d2e2`
- src/components/econometrics/MeasurementLab.astro: `#2459d3`
- src/components/econometrics/MeasurementLab.astro: `#6845b7`
- src/components/econometrics/MeasurementLab.astro: `#2459d3`
- src/components/econometrics/MeasurementLab.astro: `#6845b7`
- src/components/econometrics/MeasurementLab.astro: `#142b49`
- src/components/econometrics/MeasurementLab.astro: `#2459d3`
- src/components/econometrics/MeasurementLab.astro: `#6845b7`
- src/components/econometrics/MeasurementLab.astro: `#142b49`
- src/components/econometrics/Worlds.astro: `#e3eaf4`
- src/components/econometrics/Worlds.astro: `#506379`
- src/components/econometrics/Worlds.astro: `#e3eaf4`
- src/components/econometrics/Worlds.astro: `#506379`
- src/components/econometrics/Worlds.astro: `#142b49`
- src/components/econometrics/Worlds.astro: `#2459d3`
- src/components/econometrics/Worlds.astro: `#ad422e`
- src/components/econometrics/Worlds.astro: `#506379`
- src/components/econometrics/Worlds.astro: `#506379`
- src/components/econometrics/Worlds.astro: `#2459d3`
- src/components/econometrics/Worlds.astro: `#ad422e`
- src/layouts/Base.astro: `#F1F3F2`
- src/layouts/Econometrics.astro: `#142b49`
- src/pages/econometrics/index.astro: `#c2d2e6`
- src/pages/index.astro: `#a5a5a5`
- src/pages/index.astro: `#4a4a4a`
- src/pages/st-louis.astro: `#181e20`

## Every replacement

| File | Kind | From | To |
| --- | --- | --- | --- |
| src/components/CapabilityMatrix.astro | role | `#11131d` | `var(--ink)` |
| src/components/CapabilityMatrix.astro | primitive | `#f4f1e9` | `var(--p-neutral-95)` |
| src/components/CapabilityMatrix.astro | primitive | `#bb4e30` | `var(--p-red-47)` |
| src/components/CapabilityMatrix.astro | role | `white` | `var(--surface-raised)` |
| src/components/CapabilityMatrix.astro | role | `white` | `var(--surface-raised)` |
| src/components/CounterfactualAtlas.astro | primitive | `#0f302a` | `var(--p-teal-17)` |
| src/components/CounterfactualAtlas.astro | primitive | `#0a211e` | `var(--p-teal-11)` |
| src/components/CounterfactualAtlas.astro | primitive | `#f5f0e6` | `var(--p-neutral-95)` |
| src/components/CounterfactualAtlas.astro | primitive | `#fffdf7` | `var(--p-neutral-99)` |
| src/components/CounterfactualAtlas.astro | primitive | `#161915` | `var(--p-neutral-08)` |
| src/components/CounterfactualAtlas.astro | primitive | `#3a3f39` | `var(--p-neutral-26)` |
| src/components/CounterfactualAtlas.astro | primitive | `#6a6c64` | `var(--p-neutral-45)` |
| src/components/CounterfactualAtlas.astro | primitive | `#c9c0af` | `var(--p-gold-78)` |
| src/components/CounterfactualAtlas.astro | primitive | `#f15a37` | `var(--p-red-58)` |
| src/components/CounterfactualAtlas.astro | primitive | `#a9361f` | `var(--p-red-40)` |
| src/components/CounterfactualAtlas.astro | primitive | `#78a7a0` | `var(--p-teal-65)` |
| src/components/CounterfactualAtlas.astro | primitive | `#e0bd68` | `var(--p-gold-78b)` |
| src/components/CounterfactualAtlas.astro | primitive | `#f7f2e9` | `var(--p-neutral-95)` |
| src/components/CounterfactualAtlas.astro | primitive | `#0f302a` | `var(--p-teal-17)` |
| src/components/CounterfactualAtlas.astro | primitive | `#184139` | `var(--p-teal-25)` |
| src/components/CounterfactualAtlas.astro | primitive | `#f7f2e9` | `var(--p-neutral-95)` |
| src/components/CounterfactualAtlas.astro | primitive | `#a8b8b0` | `var(--p-neutral-73)` |
| src/components/CounterfactualAtlas.astro | primitive | `#f15a37` | `var(--p-red-58)` |
| src/components/CounterfactualAtlas.astro | primitive | `#78a7a0` | `var(--p-teal-65)` |
| src/components/CounterfactualAtlas.astro | primitive | `#e0bd68` | `var(--p-gold-78b)` |
| src/components/CounterfactualAtlas.astro | primitive | `#a9361f` | `var(--p-red-40)` |
| src/components/CounterfactualAtlas.astro | primitive | `#426158` | `var(--p-teal-39)` |
| src/components/CounterfactualAtlas.astro | primitive | `#fffdf7` | `var(--p-neutral-99)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(247, 242, 233, .25)` | `color-mix(in srgb, var(--p-neutral-95) 25%, transparent)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(247, 242, 233, .2)` | `color-mix(in srgb, var(--p-neutral-95) 20%, transparent)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(120, 167, 160, .17)` | `color-mix(in srgb, var(--p-teal-65) 17%, transparent)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(120, 167, 160, .17)` | `color-mix(in srgb, var(--p-teal-65) 17%, transparent)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(15, 48, 42, 0)` | `color-mix(in srgb, var(--p-teal-17) 0%, transparent)` |
| src/components/CounterfactualAtlas.astro | primitive | `#d6ded9` | `var(--p-neutral-88)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(10, 33, 30, .9)` | `color-mix(in srgb, var(--p-teal-11) 90%, transparent)` |
| src/components/CounterfactualAtlas.astro | primitive | `#b8c6bf` | `var(--p-neutral-79)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(247, 242, 233, .35)` | `color-mix(in srgb, var(--p-neutral-95) 35%, transparent)` |
| src/components/CounterfactualAtlas.astro | primitive | `#b8c6bf` | `var(--p-neutral-79)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(10, 33, 30, .82)` | `color-mix(in srgb, var(--p-teal-11) 82%, transparent)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(247, 242, 233, .35)` | `color-mix(in srgb, var(--p-neutral-95) 35%, transparent)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(10, 33, 30, .94)` | `color-mix(in srgb, var(--p-teal-11) 94%, transparent)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(247, 242, 233, .55)` | `color-mix(in srgb, var(--p-neutral-95) 55%, transparent)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(247, 242, 233, .22)` | `color-mix(in srgb, var(--p-neutral-95) 22%, transparent)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(247, 242, 233, .2)` | `color-mix(in srgb, var(--p-neutral-95) 20%, transparent)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(247, 242, 233, .45)` | `color-mix(in srgb, var(--p-neutral-95) 45%, transparent)` |
| src/components/CounterfactualAtlas.astro | primitive | `#b8c6bf` | `var(--p-neutral-79)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(247, 242, 233, .2)` | `color-mix(in srgb, var(--p-neutral-95) 20%, transparent)` |
| src/components/CounterfactualAtlas.astro | primitive | `#b8c6bf` | `var(--p-neutral-79)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(247, 242, 233, .28)` | `color-mix(in srgb, var(--p-neutral-95) 28%, transparent)` |
| src/components/CounterfactualAtlas.astro | primitive | `#8fa39a` | `var(--p-teal-65b)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(247, 242, 233, .18)` | `color-mix(in srgb, var(--p-neutral-95) 18%, transparent)` |
| src/components/CounterfactualAtlas.astro | primitive | `#c5d0ca` | `var(--p-neutral-83)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(10, 33, 30, .97)` | `color-mix(in srgb, var(--p-teal-11) 97%, transparent)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(247, 242, 233, .42)` | `color-mix(in srgb, var(--p-neutral-95) 42%, transparent)` |
| src/components/CounterfactualAtlas.astro | primitive | `#a8b8b0` | `var(--p-neutral-73)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(247, 242, 233, .45)` | `color-mix(in srgb, var(--p-neutral-95) 45%, transparent)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(10, 33, 30, .94)` | `color-mix(in srgb, var(--p-teal-11) 94%, transparent)` |
| src/components/CounterfactualAtlas.astro | primitive | `#b8c6bf` | `var(--p-neutral-79)` |
| src/components/CounterfactualAtlas.astro | primitive | `#a8b8b0` | `var(--p-neutral-73)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(247, 242, 233, .25)` | `color-mix(in srgb, var(--p-neutral-95) 25%, transparent)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(247, 242, 233, .35)` | `color-mix(in srgb, var(--p-neutral-95) 35%, transparent)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(247, 242, 233, .22)` | `color-mix(in srgb, var(--p-neutral-95) 22%, transparent)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(247, 242, 233, .22)` | `color-mix(in srgb, var(--p-neutral-95) 22%, transparent)` |
| src/components/CounterfactualAtlas.astro | alpha | `rgba(247, 242, 233, .2)` | `color-mix(in srgb, var(--p-neutral-95) 20%, transparent)` |
| src/components/EvidenceTransects.astro | primitive | `#0f302a` | `var(--p-teal-17)` |
| src/components/EvidenceTransects.astro | primitive | `#0a211e` | `var(--p-teal-11)` |
| src/components/EvidenceTransects.astro | primitive | `#f5f0e6` | `var(--p-neutral-95)` |
| src/components/EvidenceTransects.astro | primitive | `#fffdf7` | `var(--p-neutral-99)` |
| src/components/EvidenceTransects.astro | primitive | `#161915` | `var(--p-neutral-08)` |
| src/components/EvidenceTransects.astro | primitive | `#3a3f39` | `var(--p-neutral-26)` |
| src/components/EvidenceTransects.astro | primitive | `#6a6c64` | `var(--p-neutral-45)` |
| src/components/EvidenceTransects.astro | primitive | `#c9c0af` | `var(--p-gold-78)` |
| src/components/EvidenceTransects.astro | primitive | `#f15a37` | `var(--p-red-58)` |
| src/components/EvidenceTransects.astro | primitive | `#a9361f` | `var(--p-red-40)` |
| src/components/EvidenceTransects.astro | primitive | `#78a7a0` | `var(--p-teal-65)` |
| src/components/EvidenceTransects.astro | primitive | `#e0bd68` | `var(--p-gold-78b)` |
| src/components/EvidenceTransects.astro | primitive | `#f7f2e9` | `var(--p-neutral-95)` |
| src/components/EvidenceTransects.astro | alpha | `rgba(120, 167, 160, .1)` | `color-mix(in srgb, var(--p-teal-65) 10%, transparent)` |
| src/components/EvidenceTransects.astro | alpha | `rgba(247, 242, 233, .28)` | `color-mix(in srgb, var(--p-neutral-95) 28%, transparent)` |
| src/components/EvidenceTransects.astro | alpha | `rgba(247, 242, 233, .48)` | `color-mix(in srgb, var(--p-neutral-95) 48%, transparent)` |
| src/components/EvidenceTransects.astro | alpha | `rgba(247, 242, 233, .82)` | `color-mix(in srgb, var(--p-neutral-95) 82%, transparent)` |
| src/components/EvidenceTransects.astro | alpha | `rgba(247, 242, 233, .68)` | `color-mix(in srgb, var(--p-neutral-95) 68%, transparent)` |
| src/components/EvidenceTransects.astro | alpha | `rgba(247, 242, 233, .28)` | `color-mix(in srgb, var(--p-neutral-95) 28%, transparent)` |
| src/components/EvidenceTransects.astro | alpha | `rgba(247, 242, 233, .72)` | `color-mix(in srgb, var(--p-neutral-95) 72%, transparent)` |
| src/components/EvidenceTransects.astro | alpha | `rgba(247, 242, 233, .25)` | `color-mix(in srgb, var(--p-neutral-95) 25%, transparent)` |
| src/components/EvidenceTransects.astro | alpha | `rgba(120, 167, 160, .16)` | `color-mix(in srgb, var(--p-teal-65) 16%, transparent)` |
| src/components/EvidenceTransects.astro | alpha | `rgba(224, 189, 104, .17)` | `color-mix(in srgb, var(--p-gold-78b) 17%, transparent)` |
| src/components/EvidenceTransects.astro | alpha | `rgba(247, 242, 233, .48)` | `color-mix(in srgb, var(--p-neutral-95) 48%, transparent)` |
| src/components/ModelToMessageRelay.astro | fallback | `var(--ih-ink, #121426)` | `var(--ih-ink)` |
| src/components/ModelToMessageRelay.astro | fallback | `var(--ih-bone, #f2eade)` | `var(--ih-bone)` |
| src/components/ModelToMessageRelay.astro | fallback | `var(--ih-paper, #faf5ed)` | `var(--ih-paper)` |
| src/components/ModelToMessageRelay.astro | fallback | `var(--ih-blue, #2852e8)` | `var(--ih-blue)` |
| src/components/ModelToMessageRelay.astro | fallback | `var(--ih-blue-dark, #193fbe)` | `var(--ih-blue-dark)` |
| src/components/ModelToMessageRelay.astro | fallback | `var(--ih-graphite, #30313d)` | `var(--ih-graphite)` |
| src/components/ModelToMessageRelay.astro | fallback | `var(--ih-muted, #66636a)` | `var(--ih-muted)` |
| src/components/ModelToMessageRelay.astro | fallback | `var(--ih-rule, #c7bdb0)` | `var(--ih-rule)` |
| src/components/ModelToMessageRelay.astro | fallback | `var(--ih-oxide, #ad4e35)` | `var(--ih-oxide)` |
| src/components/ModelToMessageRelay.astro | primitive | `#a9bcff` | `var(--p-blue-77)` |
| src/components/ModelToMessageRelay.astro | role | `white` | `var(--surface-raised)` |
| src/components/ModelToMessageRelay.astro | primitive | `#d0cbc3` | `var(--p-neutral-82)` |
| src/components/ModelToMessageRelay.astro | primitive | `#aaa6a0` | `var(--p-neutral-68)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(242,234,222,.35)` | `color-mix(in srgb, var(--p-neutral-93) 35%, transparent)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(242,234,222,.55)` | `color-mix(in srgb, var(--p-neutral-93) 55%, transparent)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(242,234,222,.55)` | `color-mix(in srgb, var(--p-neutral-93) 55%, transparent)` |
| src/components/ModelToMessageRelay.astro | role | `white` | `var(--surface-raised)` |
| src/components/ModelToMessageRelay.astro | role | `white` | `var(--surface-raised)` |
| src/components/ModelToMessageRelay.astro | role | `white` | `var(--surface-raised)` |
| src/components/ModelToMessageRelay.astro | role | `white` | `var(--surface-raised)` |
| src/components/ModelToMessageRelay.astro | primitive | `#aaa6a0` | `var(--p-neutral-68)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(242,234,222,.35)` | `color-mix(in srgb, var(--p-neutral-93) 35%, transparent)` |
| src/components/ModelToMessageRelay.astro | role | `white` | `var(--surface-raised)` |
| src/components/ModelToMessageRelay.astro | primitive | `#a9bcff` | `var(--p-blue-77)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(242,234,222,.35)` | `color-mix(in srgb, var(--p-neutral-93) 35%, transparent)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(242,234,222,.25)` | `color-mix(in srgb, var(--p-neutral-93) 25%, transparent)` |
| src/components/ModelToMessageRelay.astro | primitive | `#96928c` | `var(--p-neutral-61)` |
| src/components/ModelToMessageRelay.astro | role | `white` | `var(--surface-raised)` |
| src/components/ModelToMessageRelay.astro | primitive | `#bdb8b0` | `var(--p-neutral-75)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(38,117,91,.28)` | `color-mix(in srgb, var(--p-teal-44) 28%, transparent)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(211,161,74,.14)` | `color-mix(in srgb, var(--p-gold-69) 14%, transparent)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(173,78,53,.24)` | `color-mix(in srgb, var(--p-red-45) 24%, transparent)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(242,234,222,.35)` | `color-mix(in srgb, var(--p-neutral-93) 35%, transparent)` |
| src/components/ModelToMessageRelay.astro | primitive | `#96928c` | `var(--p-neutral-61)` |
| src/components/ModelToMessageRelay.astro | primitive | `#96928c` | `var(--p-neutral-61)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(242,234,222,.08)` | `color-mix(in srgb, var(--p-neutral-93) 8%, transparent)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(242,234,222,.22)` | `color-mix(in srgb, var(--p-neutral-93) 22%, transparent)` |
| src/components/ModelToMessageRelay.astro | role | `white` | `var(--surface-raised)` |
| src/components/ModelToMessageRelay.astro | primitive | `#d3a14a` | `var(--p-gold-69)` |
| src/components/ModelToMessageRelay.astro | primitive | `#e5bd77` | `var(--p-gold-79)` |
| src/components/ModelToMessageRelay.astro | primitive | `#94aaff` | `var(--p-blue-71)` |
| src/components/ModelToMessageRelay.astro | primitive | `#94aaff` | `var(--p-blue-71)` |
| src/components/ModelToMessageRelay.astro | role | `white` | `var(--surface-raised)` |
| src/components/ModelToMessageRelay.astro | role | `white` | `var(--surface-raised)` |
| src/components/ModelToMessageRelay.astro | primitive | `#96928c` | `var(--p-neutral-61)` |
| src/components/ModelToMessageRelay.astro | primitive | `#96928c` | `var(--p-neutral-61)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(242,234,222,.13)` | `color-mix(in srgb, var(--p-neutral-93) 13%, transparent)` |
| src/components/ModelToMessageRelay.astro | primitive | `#7d829d` | `var(--p-blue-55)` |
| src/components/ModelToMessageRelay.astro | role | `white` | `var(--surface-raised)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(242,234,222,.25)` | `color-mix(in srgb, var(--p-neutral-93) 25%, transparent)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(242,234,222,.25)` | `color-mix(in srgb, var(--p-neutral-93) 25%, transparent)` |
| src/components/ModelToMessageRelay.astro | primitive | `#96928c` | `var(--p-neutral-61)` |
| src/components/ModelToMessageRelay.astro | primitive | `#d7d2ca` | `var(--p-neutral-84)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(242,234,222,.2)` | `color-mix(in srgb, var(--p-neutral-93) 20%, transparent)` |
| src/components/ModelToMessageRelay.astro | primitive | `#aaa6a0` | `var(--p-neutral-68)` |
| src/components/ModelToMessageRelay.astro | role | `white` | `var(--surface-raised)` |
| src/components/ModelToMessageRelay.astro | role | `white` | `var(--surface-raised)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(40,82,232,.1)` | `color-mix(in srgb, var(--p-blue-42) 10%, transparent)` |
| src/components/ModelToMessageRelay.astro | primitive | `#a9bcff` | `var(--p-blue-77)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(173,78,53,.22)` | `color-mix(in srgb, var(--p-red-45) 22%, transparent)` |
| src/components/ModelToMessageRelay.astro | primitive | `#ffb7a4` | `var(--p-red-81)` |
| src/components/ModelToMessageRelay.astro | primitive | `#aaa6a0` | `var(--p-neutral-68)` |
| src/components/ModelToMessageRelay.astro | role | `white` | `var(--surface-raised)` |
| src/components/ModelToMessageRelay.astro | role | `white` | `var(--surface-raised)` |
| src/components/ModelToMessageRelay.astro | primitive | `#aaa6a0` | `var(--p-neutral-68)` |
| src/components/ModelToMessageRelay.astro | primitive | `#a9bcff` | `var(--p-blue-77)` |
| src/components/ModelToMessageRelay.astro | primitive | `#96928c` | `var(--p-neutral-61)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(242,234,222,.25)` | `color-mix(in srgb, var(--p-neutral-93) 25%, transparent)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(242,234,222,.55)` | `color-mix(in srgb, var(--p-neutral-93) 55%, transparent)` |
| src/components/ModelToMessageRelay.astro | alpha | `rgba(242,234,222,.25)` | `color-mix(in srgb, var(--p-neutral-93) 25%, transparent)` |
| src/components/ModelToMessageRelay.astro | primitive | `black` | `var(--p-neutral-00)` |
| src/components/ModelToMessageRelay.astro | role | `white` | `var(--surface-raised)` |
| src/components/ModelToMessageRelay.astro | primitive | `black` | `var(--p-neutral-00)` |
| src/components/ModelToMessageRelay.astro | role | `white` | `var(--surface-raised)` |
| src/components/ModelToMessageRelay.astro | primitive | `#555` | `var(--p-neutral-36)` |
| src/components/ProjectConcierge.astro | primitive | `#09090b` | `var(--p-neutral-03)` |
| src/components/ProjectConcierge.astro | primitive | `#09090b` | `var(--p-neutral-03)` |
| src/components/ProjectConcierge.astro | primitive | `#9fa2ff` | `var(--p-blue-70)` |
| src/components/ProjectConcierge.astro | primitive | `#e4e5ff` | `var(--p-blue-92)` |
| src/components/ProjectConcierge.astro | role | `#f7f7f5` | `var(--surface)` |
| src/components/ProjectConcierge.astro | role | `#fff` | `var(--surface-raised)` |
| src/components/ProjectConcierge.astro | primitive | `#d9d9d7` | `var(--p-neutral-87)` |
| src/components/ProjectConcierge.astro | primitive | `#686870` | `var(--p-neutral-44)` |
| src/components/ProjectConcierge.astro | primitive | `#a62b25` | `var(--p-red-38)` |
| src/components/ProjectConcierge.astro | primitive | `#3337c8` | `var(--p-violet-33)` |
| src/components/ProjectConcierge.astro | alpha | `rgba(22, 25, 21, .09)` | `color-mix(in srgb, var(--p-neutral-08) 9%, transparent)` |
| src/components/ProjectConcierge.astro | alpha | `rgba(22, 25, 21, .035)` | `color-mix(in srgb, var(--p-neutral-08) 3.5%, transparent)` |
| src/components/ProjectConcierge.astro | alpha | `rgba(22, 25, 21, .035)` | `color-mix(in srgb, var(--p-neutral-08) 3.5%, transparent)` |
| src/components/ProjectConcierge.astro | primitive | `black` | `var(--p-neutral-00)` |
| src/components/ProjectConcierge.astro | primitive | `#c3d1c9` | `var(--p-neutral-83)` |
| src/components/ProjectConcierge.astro | primitive | `#78a7a0` | `var(--p-teal-65)` |
| src/components/ProjectConcierge.astro | alpha | `rgba(120, 167, 160, .16)` | `color-mix(in srgb, var(--p-teal-65) 16%, transparent)` |
| src/components/ProjectConcierge.astro | primitive | `#d6cec3` | `var(--p-neutral-83b)` |
| src/components/ProjectConcierge.astro | alpha | `rgba(255, 253, 247, .55)` | `color-mix(in srgb, var(--p-neutral-99) 55%, transparent)` |
| src/components/ProjectConcierge.astro | primitive | `#99939a` | `var(--p-neutral-62)` |
| src/components/ProjectConcierge.astro | primitive | `#f0f0ff` | `var(--p-neutral-95b)` |
| src/components/ProjectConcierge.astro | primitive | `#4b4fe9` | `var(--p-violet-43)` |
| src/components/ProjectConcierge.astro | alpha | `rgba(75, 79, 233, .18)` | `color-mix(in srgb, var(--p-violet-43) 18%, transparent)` |
| src/components/ProjectConcierge.astro | primitive | `#e8e1d7` | `var(--p-neutral-90)` |
| src/components/ProjectConcierge.astro | primitive | `#f3d5ce` | `var(--p-red-88)` |
| src/components/ProjectConcierge.astro | role | `white` | `var(--surface-raised)` |
| src/components/ProjectConcierge.astro | role | `white` | `var(--surface-raised)` |
| src/components/ProjectConcierge.astro | primitive | `#ffe8e2` | `var(--p-red-94)` |
| src/components/ProjectConcierge.astro | primitive | `#e9e4db` | `var(--p-neutral-90)` |
| src/components/ProjectConcierge.astro | role | `white` | `var(--surface-raised)` |
| src/components/ProjectConcierge.astro | role | `white` | `var(--surface-raised)` |
| src/components/ProjectConcierge.astro | role | `white` | `var(--surface-raised)` |
| src/components/ProjectConcierge.astro | primitive | `#bbb9c2` | `var(--p-neutral-76)` |
| src/components/ProjectConcierge.astro | role | `white` | `var(--surface-raised)` |
| src/components/ProjectConcierge.astro | alpha | `rgba(255,255,255,.45)` | `color-mix(in srgb, var(--p-figure) 45%, transparent)` |
| src/components/ProjectConcierge.astro | alpha | `rgba(255,255,255,.45)` | `color-mix(in srgb, var(--p-figure) 45%, transparent)` |
| src/components/ProjectConcierge.astro | role | `white` | `var(--surface-raised)` |
| src/components/ProjectConcierge.astro | role | `white` | `var(--surface-raised)` |
| src/components/ProjectConcierge.astro | primitive | `#c2bec6` | `var(--p-neutral-78)` |
| src/components/ProjectConcierge.astro | role | `white` | `var(--surface-raised)` |
| src/components/ProjectConcierge.astro | primitive | `#696a75` | `var(--p-neutral-44)` |
| src/components/ProjectConcierge.astro | primitive | `#bebbc4` | `var(--p-neutral-76)` |
| src/components/ProjectConcierge.astro | primitive | `#7ff1cf` | `var(--p-teal-88)` |
| src/components/ProjectConcierge.astro | primitive | `#ff998b` | `var(--p-red-73)` |
| src/components/ProjectConcierge.astro | role | `white` | `var(--surface-raised)` |
| src/components/ProjectConcierge.astro | role | `white` | `var(--surface-raised)` |
| src/components/ProjectConcierge.astro | role | `white` | `var(--surface-raised)` |
| src/components/ProjectConcierge.astro | alpha | `rgba(16, 18, 31, .09)` | `color-mix(in srgb, var(--p-blue-06) 9%, transparent)` |
| src/components/ProjectConcierge.astro | alpha | `rgba(255,255,255,.45)` | `color-mix(in srgb, var(--p-figure) 45%, transparent)` |
| src/components/ProjectDrawing.astro | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/components/ProjectDrawing.astro | primitive | `#ddd` | `var(--p-neutral-87)` |
| src/components/ProjectDrawing.astro | primitive | `#333` | `var(--p-neutral-21)` |
| src/components/ProjectDrawing.astro | primitive | `#353535` | `var(--p-neutral-21)` |
| src/components/ProjectDrawing.astro | primitive | `#d4d4d4` | `var(--p-neutral-85)` |
| src/components/ProjectDrawing.astro | role | `#fff` | `var(--surface-raised)` |
| src/components/ProjectDrawing.astro | primitive | `#aaa` | `var(--p-neutral-70)` |
| src/components/ProjectDrawing.astro | role | `#fff` | `var(--surface-raised)` |
| src/components/ProjectDrawing.astro | primitive | `#777` | `var(--p-neutral-50)` |
| src/components/ProjectDrawing.astro | primitive | `#747474` | `var(--p-neutral-50)` |
| src/components/ProjectDrawing.astro | primitive | `#c8c8c8` | `var(--p-neutral-81)` |
| src/components/ProjectDrawing.astro | role | `#fff` | `var(--surface-raised)` |
| src/components/ProjectDrawing.astro | primitive | `#3a3a3a` | `var(--p-neutral-24)` |
| src/components/ProjectDrawing.astro | primitive | `#bbb` | `var(--p-neutral-76b)` |
| src/components/ProofCircuit.astro | primitive | `#0f302a` | `var(--p-teal-17)` |
| src/components/ProofCircuit.astro | primitive | `#0a211e` | `var(--p-teal-11)` |
| src/components/ProofCircuit.astro | primitive | `#f5f0e6` | `var(--p-neutral-95)` |
| src/components/ProofCircuit.astro | primitive | `#fffdf7` | `var(--p-neutral-99)` |
| src/components/ProofCircuit.astro | primitive | `#161915` | `var(--p-neutral-08)` |
| src/components/ProofCircuit.astro | primitive | `#3a3f39` | `var(--p-neutral-26)` |
| src/components/ProofCircuit.astro | primitive | `#6a6c64` | `var(--p-neutral-45)` |
| src/components/ProofCircuit.astro | primitive | `#c9c0af` | `var(--p-gold-78)` |
| src/components/ProofCircuit.astro | primitive | `#f15a37` | `var(--p-red-58)` |
| src/components/ProofCircuit.astro | primitive | `#a9361f` | `var(--p-red-40)` |
| src/components/ProofCircuit.astro | primitive | `#78a7a0` | `var(--p-teal-65)` |
| src/components/ProofCircuit.astro | primitive | `#e0bd68` | `var(--p-gold-78b)` |
| src/components/ProofCircuit.astro | primitive | `#f7f2e9` | `var(--p-neutral-95)` |
| src/components/ProofCircuit.astro | alpha | `rgba(120, 167, 160, .22)` | `color-mix(in srgb, var(--p-teal-65) 22%, transparent)` |
| src/components/ProofCircuit.astro | alpha | `rgba(120, 167, 160, .22)` | `color-mix(in srgb, var(--p-teal-65) 22%, transparent)` |
| src/components/ProofCircuit.astro | primitive | `black` | `var(--p-neutral-00)` |
| src/components/ProofCircuit.astro | alpha | `rgba(120, 167, 160, .2)` | `color-mix(in srgb, var(--p-teal-65) 20%, transparent)` |
| src/components/ProofCircuit.astro | alpha | `rgba(247, 242, 233, .2)` | `color-mix(in srgb, var(--p-neutral-95) 20%, transparent)` |
| src/components/ProofCircuit.astro | alpha | `rgba(247, 242, 233, .58)` | `color-mix(in srgb, var(--p-neutral-95) 58%, transparent)` |
| src/components/ProofCircuit.astro | alpha | `rgba(247, 242, 233, .5)` | `color-mix(in srgb, var(--p-neutral-95) 50%, transparent)` |
| src/components/ProofCircuit.astro | alpha | `rgba(10, 33, 30, .88)` | `color-mix(in srgb, var(--p-teal-11) 88%, transparent)` |
| src/components/ProofCircuit.astro | alpha | `rgba(201, 192, 175, .18)` | `color-mix(in srgb, var(--p-gold-78) 18%, transparent)` |
| src/components/ProofCircuit.astro | alpha | `rgba(247, 242, 233, .7)` | `color-mix(in srgb, var(--p-neutral-95) 70%, transparent)` |
| src/components/ProofCircuit.astro | alpha | `rgba(120, 167, 160, .62)` | `color-mix(in srgb, var(--p-teal-65) 62%, transparent)` |
| src/components/SpatialAllocationStudio.astro | fallback | `var(--ih-ink, #121426)` | `var(--ih-ink)` |
| src/components/SpatialAllocationStudio.astro | fallback | `var(--ih-bone, #f2eade)` | `var(--ih-bone)` |
| src/components/SpatialAllocationStudio.astro | fallback | `var(--ih-paper, #faf5ed)` | `var(--ih-paper)` |
| src/components/SpatialAllocationStudio.astro | fallback | `var(--ih-blue, #2852e8)` | `var(--ih-blue)` |
| src/components/SpatialAllocationStudio.astro | fallback | `var(--ih-blue-dark, #193fbe)` | `var(--ih-blue-dark)` |
| src/components/SpatialAllocationStudio.astro | fallback | `var(--ih-graphite, #30313d)` | `var(--ih-graphite)` |
| src/components/SpatialAllocationStudio.astro | fallback | `var(--ih-muted, #66636a)` | `var(--ih-muted)` |
| src/components/SpatialAllocationStudio.astro | fallback | `var(--ih-rule, #c7bdb0)` | `var(--ih-rule)` |
| src/components/SpatialAllocationStudio.astro | fallback | `var(--ih-oxide, #ad4e35)` | `var(--ih-oxide)` |
| src/components/SpatialAllocationStudio.astro | role | `white` | `var(--surface-raised)` |
| src/components/SpatialAllocationStudio.astro | role | `white` | `var(--surface-raised)` |
| src/components/SpatialAllocationStudio.astro | role | `white` | `var(--surface-raised)` |
| src/components/SpatialAllocationStudio.astro | primitive | `#aaa6a0` | `var(--p-neutral-68)` |
| src/components/SpatialAllocationStudio.astro | alpha | `rgba(242,234,222,.35)` | `color-mix(in srgb, var(--p-neutral-93) 35%, transparent)` |
| src/components/SpatialAllocationStudio.astro | role | `white` | `var(--surface-raised)` |
| src/components/SpatialAllocationStudio.astro | primitive | `#222536` | `var(--p-blue-15)` |
| src/components/SpatialAllocationStudio.astro | alpha | `rgba(242,234,222,.45)` | `color-mix(in srgb, var(--p-neutral-93) 45%, transparent)` |
| src/components/SpatialAllocationStudio.astro | primitive | `#e8eefb` | `var(--p-neutral-94)` |
| src/components/SpatialAllocationStudio.astro | alpha | `rgba(18,20,38,.55)` | `color-mix(in srgb, var(--p-blue-07) 55%, transparent)` |
| src/components/SpatialAllocationStudio.astro | primitive | `#e8eefb` | `var(--p-neutral-94)` |
| src/components/SpatialAllocationStudio.astro | primitive | `#bdcdf9` | `var(--p-blue-83)` |
| src/components/SpatialAllocationStudio.astro | primitive | `#86a5f2` | `var(--p-blue-68)` |
| src/components/SpatialAllocationStudio.astro | role | `white` | `var(--surface-raised)` |
| src/components/SpatialAllocationStudio.astro | primitive | `#4f79ec` | `var(--p-blue-53)` |
| src/components/SpatialAllocationStudio.astro | role | `white` | `var(--surface-raised)` |
| src/components/SpatialAllocationStudio.astro | role | `white` | `var(--surface-raised)` |
| src/components/SpatialAllocationStudio.astro | alpha | `rgba(255,255,255,.75)` | `color-mix(in srgb, var(--p-figure) 75%, transparent)` |
| src/components/SpatialAllocationStudio.astro | role | `white` | `var(--surface-raised)` |
| src/components/SpatialAllocationStudio.astro | role | `white` | `var(--surface-raised)` |
| src/components/SpatialAllocationStudio.astro | role | `white` | `var(--surface-raised)` |
| src/components/SpatialAllocationStudio.astro | alpha | `rgba(173,78,53,.35)` | `color-mix(in srgb, var(--p-red-45) 35%, transparent)` |
| src/components/SpatialAllocationStudio.astro | role | `white` | `var(--surface-raised)` |
| src/components/SpatialAllocationStudio.astro | role | `white` | `var(--surface-raised)` |
| src/components/SpatialAllocationStudio.astro | role | `white` | `var(--surface-raised)` |
| src/components/SpatialAllocationStudio.astro | primitive | `#aaa6a0` | `var(--p-neutral-68)` |
| src/components/SpatialAllocationStudio.astro | primitive | `#e8eefb` | `var(--p-neutral-94)` |
| src/components/SpatialAllocationStudio.astro | primitive | `#bdcdf9` | `var(--p-blue-83)` |
| src/components/SpatialAllocationStudio.astro | primitive | `#86a5f2` | `var(--p-blue-68)` |
| src/components/SpatialAllocationStudio.astro | primitive | `#4f79ec` | `var(--p-blue-53)` |
| src/components/SpatialAllocationStudio.astro | alpha | `rgba(255,255,255,.5)` | `color-mix(in srgb, var(--p-figure) 50%, transparent)` |
| src/components/SpatialAllocationStudio.astro | primitive | `#d7d2ca` | `var(--p-neutral-84)` |
| src/components/SpatialAllocationStudio.astro | role | `white` | `var(--surface-raised)` |
| src/components/SpatialAllocationStudio.astro | alpha | `rgba(242,234,222,.35)` | `color-mix(in srgb, var(--p-neutral-93) 35%, transparent)` |
| src/components/SpatialAllocationStudio.astro | role | `white` | `var(--surface-raised)` |
| src/components/SpatialAllocationStudio.astro | alpha | `rgba(242,234,222,.25)` | `color-mix(in srgb, var(--p-neutral-93) 25%, transparent)` |
| src/components/SpatialAllocationStudio.astro | primitive | `#aaa6a0` | `var(--p-neutral-68)` |
| src/components/SpatialAllocationStudio.astro | role | `white` | `var(--surface-raised)` |
| src/components/SpatialAllocationStudio.astro | alpha | `rgba(40,82,232,.09)` | `color-mix(in srgb, var(--p-blue-42) 9%, transparent)` |
| src/components/SpatialAllocationStudio.astro | primitive | `#aaa6a0` | `var(--p-neutral-68)` |
| src/components/SpatialAllocationStudio.astro | primitive | `#a9bcff` | `var(--p-blue-77)` |
| src/components/SpatialAllocationStudio.astro | alpha | `rgba(242,234,222,.25)` | `color-mix(in srgb, var(--p-neutral-93) 25%, transparent)` |
| src/components/SpatialAllocationStudio.astro | alpha | `rgba(242,234,222,.25)` | `color-mix(in srgb, var(--p-neutral-93) 25%, transparent)` |
| src/components/SpatialAllocationStudio.astro | alpha | `rgba(242,234,222,.25)` | `color-mix(in srgb, var(--p-neutral-93) 25%, transparent)` |
| src/components/StudioFrontDoor.astro | primitive | `#2852e8` | `var(--p-blue-42)` |
| src/components/StudioFrontDoor.astro | primitive | `#1737a5` | `var(--p-blue-28)` |
| src/components/StudioFrontDoor.astro | primitive | `#f2eade` | `var(--p-neutral-93)` |
| src/components/StudioFrontDoor.astro | primitive | `#faf5ed` | `var(--p-neutral-95)` |
| src/components/StudioFrontDoor.astro | primitive | `#121426` | `var(--p-blue-07)` |
| src/components/StudioFrontDoor.astro | primitive | `#30313d` | `var(--p-blue-21)` |
| src/components/StudioFrontDoor.astro | primitive | `#66636a` | `var(--p-neutral-42)` |
| src/components/StudioFrontDoor.astro | primitive | `#c7bdb0` | `var(--p-neutral-77)` |
| src/components/StudioFrontDoor.astro | primitive | `#2b9c6f` | `var(--p-teal-57)` |
| src/components/StudioFrontDoor.astro | role | `white` | `var(--surface-raised)` |
| src/components/StudioFrontDoor.astro | alpha | `rgba(242, 234, 222, .24)` | `color-mix(in srgb, var(--p-neutral-93) 24%, transparent)` |
| src/components/StudioFrontDoor.astro | alpha | `rgba(242, 234, 222, .24)` | `color-mix(in srgb, var(--p-neutral-93) 24%, transparent)` |
| src/components/StudioFrontDoor.astro | alpha | `rgba(185, 192, 216, .2)` | `color-mix(in srgb, var(--p-blue-78) 20%, transparent)` |
| src/components/StudioFrontDoor.astro | alpha | `rgba(185, 192, 216, .2)` | `color-mix(in srgb, var(--p-blue-78) 20%, transparent)` |
| src/components/StudioFrontDoor.astro | alpha | `rgba(40, 82, 232, .6)` | `color-mix(in srgb, var(--p-blue-42) 60%, transparent)` |
| src/components/StudioFrontDoor.astro | alpha | `rgba(40, 82, 232, .18)` | `color-mix(in srgb, var(--p-blue-42) 18%, transparent)` |
| src/components/StudioFrontDoor.astro | alpha | `rgba(40, 82, 232, .12)` | `color-mix(in srgb, var(--p-blue-42) 12%, transparent)` |
| src/components/StudioFrontDoor.astro | alpha | `rgba(242, 234, 222, .55)` | `color-mix(in srgb, var(--p-neutral-93) 55%, transparent)` |
| src/components/StudioFrontDoor.astro | alpha | `rgba(242, 234, 222, .45)` | `color-mix(in srgb, var(--p-neutral-93) 45%, transparent)` |
| src/components/StudioFrontDoor.astro | alpha | `rgba(242, 234, 222, .055)` | `color-mix(in srgb, var(--p-neutral-93) 5.5%, transparent)` |
| src/components/StudioFrontDoor.astro | alpha | `rgba(242, 234, 222, .24)` | `color-mix(in srgb, var(--p-neutral-93) 24%, transparent)` |
| src/components/StudioFrontDoor.astro | alpha | `rgba(242, 234, 222, .16)` | `color-mix(in srgb, var(--p-neutral-93) 16%, transparent)` |
| src/components/StudioFrontDoor.astro | role | `white` | `var(--surface-raised)` |
| src/components/StudioFrontDoor.astro | alpha | `rgba(242, 234, 222, .16)` | `color-mix(in srgb, var(--p-neutral-93) 16%, transparent)` |
| src/components/StudioFrontDoor.astro | alpha | `rgba(40, 82, 232, .055)` | `color-mix(in srgb, var(--p-blue-42) 5.5%, transparent)` |
| src/components/StudioFrontDoor.astro | alpha | `rgba(242, 234, 222, .16)` | `color-mix(in srgb, var(--p-neutral-93) 16%, transparent)` |
| src/components/TechnicalProjects.astro | primitive | `#bdbdbd` | `var(--p-neutral-76b)` |
| src/components/TechnicalProjects.astro | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/components/TechnicalProjects.astro | primitive | `#606060` | `var(--p-neutral-41)` |
| src/components/TechnicalProjects.astro | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/components/TechnicalProjects.astro | primitive | `#555` | `var(--p-neutral-36)` |
| src/components/TechnicalProjects.astro | primitive | `#bdbdbd` | `var(--p-neutral-76b)` |
| src/components/TechnicalProjects.astro | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/components/TechnicalProjects.astro | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/components/TechnicalProjects.astro | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/components/TechnicalProjects.astro | primitive | `#444` | `var(--p-neutral-29)` |
| src/components/TechnicalProjects.astro | primitive | `#666` | `var(--p-neutral-43)` |
| src/components/TechnicalProjects.astro | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/components/econometrics/CourseFeature.astro | primitive | `#edf3ff` | `var(--p-neutral-94)` |
| src/pages/projects/[slug].astro | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/pages/projects/[slug].astro | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/pages/projects/[slug].astro | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/pages/projects/[slug].astro | primitive | `#555` | `var(--p-neutral-36)` |
| src/pages/projects/[slug].astro | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/pages/projects/[slug].astro | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/pages/projects/[slug].astro | primitive | `#606060` | `var(--p-neutral-41)` |
| src/styles/calculus.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/calculus.css | role | `#fafafa` | `var(--surface-raised)` |
| src/styles/calculus.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/calculus.css | role | `#fafafa` | `var(--surface-raised)` |
| src/styles/calculus.css | primitive | `#64656b` | `var(--p-neutral-42)` |
| src/styles/calculus.css | primitive | `#aa9bff` | `var(--p-blue-69)` |
| src/styles/calculus.css | primitive | `#ffc58b` | `var(--p-gold-83)` |
| src/styles/calculus.css | primitive | `#89dfc8` | `var(--p-teal-83)` |
| src/styles/calculus.css | primitive | `#574b86` | `var(--p-violet-36)` |
| src/styles/calculus.css | primitive | `#8873ed` | `var(--p-violet-56)` |
| src/styles/calculus.css | primitive | `#dedee5` | `var(--p-neutral-89)` |
| src/styles/calculus.css | primitive | `#575761` | `var(--p-neutral-37)` |
| src/styles/calculus.css | primitive | `#edebf4` | `var(--p-neutral-93b)` |
| src/styles/calculus.css | primitive | `#c4bed5` | `var(--p-violet-78)` |
| src/styles/calculus.css | primitive | `#191923` | `var(--p-neutral-09)` |
| src/styles/calculus.css | primitive | `#191923` | `var(--p-neutral-09)` |
| src/styles/calculus.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/calculus.css | alpha | `#21182c16` | `color-mix(in srgb, var(--p-violet-10) 8.6%, transparent)` |
| src/styles/calculus.css | primitive | `#f1effb` | `var(--p-neutral-95b)` |
| src/styles/calculus.css | primitive | `#aeafc2` | `var(--p-blue-72)` |
| src/styles/calculus.css | primitive | `#131522` | `var(--p-blue-06)` |
| src/styles/calculus.css | primitive | `#272a3e` | `var(--p-blue-18)` |
| src/styles/calculus.css | alpha | `#20184770` | `color-mix(in srgb, var(--p-violet-12) 43.9%, transparent)` |
| src/styles/calculus.css | primitive | `#f1effb` | `var(--p-neutral-95b)` |
| src/styles/calculus.css | alpha | `#ffffff12` | `color-mix(in srgb, var(--p-figure) 7.1%, transparent)` |
| src/styles/calculus.css | primitive | `#bdb0ff` | `var(--p-blue-76)` |
| src/styles/calculus.css | primitive | `#bcbccd` | `var(--p-blue-77b)` |
| src/styles/calculus.css | alpha | `#ffffff04` | `color-mix(in srgb, var(--p-figure) 1.6%, transparent)` |
| src/styles/calculus.css | alpha | `#ffffff04` | `color-mix(in srgb, var(--p-figure) 1.6%, transparent)` |
| src/styles/calculus.css | primitive | `#85889e` | `var(--p-blue-57)` |
| src/styles/calculus.css | alpha | `#ffffff23` | `color-mix(in srgb, var(--p-figure) 13.7%, transparent)` |
| src/styles/calculus.css | alpha | `#ffffff06` | `color-mix(in srgb, var(--p-figure) 2.4%, transparent)` |
| src/styles/calculus.css | primitive | `#d7d2f3` | `var(--p-blue-86)` |
| src/styles/calculus.css | alpha | `#ffffff12` | `color-mix(in srgb, var(--p-figure) 7.1%, transparent)` |
| src/styles/calculus.css | primitive | `#aa9bff` | `var(--p-blue-69)` |
| src/styles/calculus.css | primitive | `#171525` | `var(--p-blue-08)` |
| src/styles/calculus.css | primitive | `#aa9bff` | `var(--p-blue-69)` |
| src/styles/calculus.css | primitive | `#d6d3e7` | `var(--p-blue-85)` |
| src/styles/calculus.css | primitive | `#9698b0` | `var(--p-blue-63)` |
| src/styles/calculus.css | alpha | `#ffffff10` | `color-mix(in srgb, var(--p-figure) 6.3%, transparent)` |
| src/styles/calculus.css | primitive | `#ebe7ff` | `var(--p-blue-93)` |
| src/styles/calculus.css | alpha | `#aa9bff40` | `color-mix(in srgb, var(--p-blue-69) 25.1%, transparent)` |
| src/styles/calculus.css | primitive | `#262b42` | `var(--p-blue-18b)` |
| src/styles/calculus.css | primitive | `#676b8b` | `var(--p-blue-46)` |
| src/styles/calculus.css | alpha | `#aa9bff20` | `color-mix(in srgb, var(--p-blue-69) 12.5%, transparent)` |
| src/styles/calculus.css | primitive | `#151524` | `var(--p-blue-08)` |
| src/styles/calculus.css | alpha | `#b3a0ff70` | `color-mix(in srgb, var(--p-violet-71) 43.9%, transparent)` |
| src/styles/calculus.css | primitive | `#f1edff` | `var(--p-blue-95)` |
| src/styles/calculus.css | alpha | `#ffc58b16` | `color-mix(in srgb, var(--p-gold-83) 8.6%, transparent)` |
| src/styles/calculus.css | alpha | `#ffc58b55` | `color-mix(in srgb, var(--p-gold-83) 33.3%, transparent)` |
| src/styles/calculus.css | primitive | `#ffc58b` | `var(--p-gold-83)` |
| src/styles/calculus.css | primitive | `#fff1dc` | `var(--p-gold-96)` |
| src/styles/calculus.css | primitive | `#171725` | `var(--p-blue-08)` |
| src/styles/calculus.css | primitive | `#bfbdd1` | `var(--p-blue-77b)` |
| src/styles/calculus.css | primitive | `#9899ae` | `var(--p-blue-63)` |
| src/styles/calculus.css | alpha | `#ffffff0d` | `color-mix(in srgb, var(--p-figure) 5.1%, transparent)` |
| src/styles/calculus.css | alpha | `#ffffff12` | `color-mix(in srgb, var(--p-figure) 7.1%, transparent)` |
| src/styles/calculus.css | alpha | `#ffffff02` | `color-mix(in srgb, var(--p-figure) 0.8%, transparent)` |
| src/styles/calculus.css | primitive | `#a1a1b8` | `var(--p-blue-67)` |
| src/styles/calculus.css | primitive | `#aaa6c1` | `var(--p-blue-69b)` |
| src/styles/calculus.css | primitive | `#e1deee` | `var(--p-blue-89)` |
| src/styles/calculus.css | primitive | `#bcaaff` | `var(--p-violet-74)` |
| src/styles/calculus.css | primitive | `#b1a0ff` | `var(--p-violet-71)` |
| src/styles/calculus.css | primitive | `#4a415f` | `var(--p-violet-30)` |
| src/styles/calculus.css | primitive | `#494254` | `var(--p-violet-29)` |
| src/styles/calculus.css | primitive | `#e1deee` | `var(--p-blue-89)` |
| src/styles/calculus.css | primitive | `#232231` | `var(--p-blue-14)` |
| src/styles/calculus.css | primitive | `#b1a0ff` | `var(--p-violet-71)` |
| src/styles/calculus.css | primitive | `#b1a0ff` | `var(--p-violet-71)` |
| src/styles/calculus.css | primitive | `#191624` | `var(--p-blue-08)` |
| src/styles/calculus.css | alpha | `#00000015` | `color-mix(in srgb, var(--p-neutral-00) 8.2%, transparent)` |
| src/styles/calculus.css | primitive | `#c3b6ff` | `var(--p-blue-77c)` |
| src/styles/calculus.css | primitive | `#b5b1c8` | `var(--p-blue-73)` |
| src/styles/calculus.css | primitive | `#b5b1c8` | `var(--p-blue-73)` |
| src/styles/calculus.css | alpha | `#ffffff12` | `color-mix(in srgb, var(--p-figure) 7.1%, transparent)` |
| src/styles/calculus.css | alpha | `#00000015` | `color-mix(in srgb, var(--p-neutral-00) 8.2%, transparent)` |
| src/styles/calculus.css | alpha | `#ffffff13` | `color-mix(in srgb, var(--p-figure) 7.5%, transparent)` |
| src/styles/calculus.css | primitive | `#a9a6be` | `var(--p-blue-69b)` |
| src/styles/calculus.css | primitive | `#f2edff` | `var(--p-blue-95)` |
| src/styles/calculus.css | primitive | `#89dfc8` | `var(--p-teal-83)` |
| src/styles/calculus.css | primitive | `#ffc58b` | `var(--p-gold-83)` |
| src/styles/calculus.css | primitive | `#d6d4de` | `var(--p-neutral-85b)` |
| src/styles/calculus.css | primitive | `#ccc7d8` | `var(--p-violet-81)` |
| src/styles/calculus.css | primitive | `#f0edf8` | `var(--p-neutral-93b)` |
| src/styles/calculus.css | primitive | `#6956a7` | `var(--p-violet-42)` |
| src/styles/calculus.css | primitive | `#eee9fa` | `var(--p-blue-95)` |
| src/styles/calculus.css | primitive | `#645777` | `var(--p-violet-39)` |
| src/styles/calculus.css | alpha | `#ffffff05` | `color-mix(in srgb, var(--p-figure) 2%, transparent)` |
| src/styles/calculus.css | primitive | `#b4a3e0` | `var(--p-violet-70)` |
| src/styles/calculus.css | primitive | `#bdb4d0` | `var(--p-violet-75)` |
| src/styles/calculus.css | primitive | `#eee8ff` | `var(--p-blue-93)` |
| src/styles/calculus.css | primitive | `#d6d4de` | `var(--p-neutral-85b)` |
| src/styles/calculus.css | primitive | `#64606e` | `var(--p-violet-42b)` |
| src/styles/calculus.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/calculus.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/calculus.css | primitive | `#fff0e8` | `var(--p-neutral-96)` |
| src/styles/calculus.css | primitive | `#ad5127` | `var(--p-red-46)` |
| src/styles/calculus.css | primitive | `#64606e` | `var(--p-violet-42b)` |
| src/styles/calculus.css | primitive | `#d3cedd` | `var(--p-violet-84)` |
| src/styles/calculus.css | role | `white` | `var(--surface-raised)` |
| src/styles/calculus.css | alpha | `#ffffff12` | `color-mix(in srgb, var(--p-figure) 7.1%, transparent)` |
| src/styles/calculus.css | primitive | `#191725` | `var(--p-blue-08)` |
| src/styles/calculus.css | primitive | `#bbaaff` | `var(--p-violet-74)` |
| src/styles/calculus.css | primitive | `#bbaaff` | `var(--p-violet-74)` |
| src/styles/calculus.css | primitive | `#191725` | `var(--p-blue-08)` |
| src/styles/calculus.css | primitive | `#bbaaff` | `var(--p-violet-74)` |
| src/styles/calculus.css | primitive | `#bbaaff` | `var(--p-violet-74)` |
| src/styles/calculus.css | primitive | `#4a415f` | `var(--p-violet-30)` |
| src/styles/calculus.css | primitive | `#dedbe5` | `var(--p-neutral-88b)` |
| src/styles/calculus.css | primitive | `#d3cedf` | `var(--p-violet-84)` |
| src/styles/calculus.css | primitive | `#eeebf3` | `var(--p-neutral-93b)` |
| src/styles/calculus.css | primitive | `#615a73` | `var(--p-violet-40)` |
| src/styles/calculus.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/calculus.css | primitive | `#29203c` | `var(--p-violet-15)` |
| src/styles/calculus.css | alpha | `#26163c18` | `color-mix(in srgb, var(--p-violet-11) 9.4%, transparent)` |
| src/styles/calculus.css | primitive | `#b4a3e0` | `var(--p-violet-70)` |
| src/styles/calculus.css | primitive | `#d1cbdf` | `var(--p-violet-83)` |
| src/styles/calculus.css | alpha | `#ffffff16` | `color-mix(in srgb, var(--p-figure) 8.6%, transparent)` |
| src/styles/calculus.css | primitive | `#aaa4bf` | `var(--p-blue-69b)` |
| src/styles/calculus.css | alpha | `#ffffff22` | `color-mix(in srgb, var(--p-figure) 13.3%, transparent)` |
| src/styles/calculus.css | alpha | `#aa9bff0b` | `color-mix(in srgb, var(--p-blue-69) 4.3%, transparent)` |
| src/styles/calculus.css | primitive | `#e0d8f8` | `var(--p-violet-88)` |
| src/styles/calculus.css | primitive | `#aa9bff` | `var(--p-blue-69)` |
| src/styles/calculus.css | alpha | `#aa9bff1c` | `color-mix(in srgb, var(--p-blue-69) 11%, transparent)` |
| src/styles/calculus.css | primitive | `#aa9bff` | `var(--p-blue-69)` |
| src/styles/calculus.css | primitive | `#d6d4de` | `var(--p-neutral-85b)` |
| src/styles/calculus.css | primitive | `#b7abc9` | `var(--p-violet-72)` |
| src/styles/calculus.css | primitive | `#594782` | `var(--p-violet-34)` |
| src/styles/calculus.css | primitive | `#f0edf6` | `var(--p-neutral-93b)` |
| src/styles/calculus.css | primitive | `#e2ddec` | `var(--p-blue-89)` |
| src/styles/calculus.css | primitive | `#8e80a7` | `var(--p-violet-56b)` |
| src/styles/calculus.css | primitive | `#3f3157` | `var(--p-violet-23)` |
| src/styles/calculus.css | primitive | `#513784` | `var(--p-violet-30b)` |
| src/styles/calculus.css | primitive | `#62576f` | `var(--p-violet-40)` |
| src/styles/calculus.css | primitive | `#51495d` | `var(--p-violet-32)` |
| src/styles/content-clarity.css | primitive | `#c9c9c9` | `var(--p-neutral-81)` |
| src/styles/content-clarity.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/content-clarity.css | primitive | `#666` | `var(--p-neutral-43)` |
| src/styles/content-clarity.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/content-clarity.css | primitive | `#444` | `var(--p-neutral-29)` |
| src/styles/content-clarity.css | primitive | `#d4d4d4` | `var(--p-neutral-85)` |
| src/styles/content-clarity.css | primitive | `#666` | `var(--p-neutral-43)` |
| src/styles/content-clarity.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/content-clarity.css | primitive | `#d4d4d4` | `var(--p-neutral-85)` |
| src/styles/content-clarity.css | role | `#fafafa` | `var(--surface-raised)` |
| src/styles/content-clarity.css | role | `#f0f0f0` | `var(--surface)` |
| src/styles/content-clarity.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/content-clarity.css | role | `#fafafa` | `var(--surface-raised)` |
| src/styles/content-clarity.css | role | `#f0f0f0` | `var(--surface)` |
| src/styles/content-clarity.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/content-clarity.css | primitive | `#555` | `var(--p-neutral-36)` |
| src/styles/content-clarity.css | primitive | `#555` | `var(--p-neutral-36)` |
| src/styles/content-clarity.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/content-clarity.css | role | `#fafafa` | `var(--surface-raised)` |
| src/styles/content-clarity.css | primitive | `#666` | `var(--p-neutral-43)` |
| src/styles/content-clarity.css | role | `#fafafa` | `var(--surface-raised)` |
| src/styles/content-clarity.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/content-clarity.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/content-clarity.css | primitive | `#aaa` | `var(--p-neutral-70)` |
| src/styles/content-clarity.css | role | `#fafafa` | `var(--surface-raised)` |
| src/styles/econometrics.css | primitive | `#142b49` | `var(--p-blue-17)` |
| src/styles/econometrics.css | primitive | `#f4f7fb` | `var(--p-neutral-97)` |
| src/styles/econometrics.css | primitive | `#2459d3` | `var(--p-blue-42b)` |
| src/styles/econometrics.css | primitive | `#506379` | `var(--p-blue-41)` |
| src/styles/econometrics.css | primitive | `#c7d2e2` | `var(--p-blue-84)` |
| src/styles/econometrics.css | primitive | `#ad422e` | `var(--p-red-43)` |
| src/styles/econometrics.css | primitive | `#126d65` | `var(--p-teal-41)` |
| src/styles/econometrics.css | primitive | `#caddff` | `var(--p-blue-88)` |
| src/styles/econometrics.css | role | `white` | `var(--surface-raised)` |
| src/styles/econometrics.css | role | `white` | `var(--surface-raised)` |
| src/styles/econometrics.css | role | `white` | `var(--surface-raised)` |
| src/styles/econometrics.css | role | `white` | `var(--surface-raised)` |
| src/styles/econometrics.css | primitive | `#edf4ff` | `var(--p-neutral-96b)` |
| src/styles/econometrics.css | primitive | `#c2d2e6` | `var(--p-blue-84b)` |
| src/styles/econometrics.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/econometrics.css | primitive | `#e6edfc` | `var(--p-neutral-94)` |
| src/styles/econometrics.css | primitive | `#eaf0f8` | `var(--p-neutral-95c)` |
| src/styles/econometrics.css | primitive | `#edf5f3` | `var(--p-neutral-96c)` |
| src/styles/econometrics.css | primitive | `#b7d6ce` | `var(--p-teal-83b)` |
| src/styles/econometrics.css | role | `white` | `var(--surface-raised)` |
| src/styles/econometrics.css | role | `white` | `var(--surface-raised)` |
| src/styles/econometrics.css | primitive | `#edf2fa` | `var(--p-neutral-95c)` |
| src/styles/econometrics.css | primitive | `#fff5ef` | `var(--p-neutral-97b)` |
| src/styles/econometrics.css | role | `white` | `var(--surface-raised)` |
| src/styles/econometrics.css | primitive | `#111` | `var(--p-neutral-05)` |
| src/styles/econometrics.css | role | `white` | `var(--surface-raised)` |
| src/styles/fieldbook.css | primitive | `black` | `var(--p-neutral-00)` |
| src/styles/fieldbook.css | role | `white` | `var(--surface-raised)` |
| src/styles/fieldbook.css | primitive | `black` | `var(--p-neutral-00)` |
| src/styles/global.css | fallback | `var(--ef-paper, #F1F3F2)` | `var(--ef-paper)` |
| src/styles/global.css | fallback | `var(--ef-paper, #F1F3F2)` | `var(--ef-paper)` |
| src/styles/global.css | fallback | `var(--ef-ink, #11131D)` | `var(--ef-ink)` |
| src/styles/global.css | fallback | `var(--ef-paper, #F1F3F2)` | `var(--ef-paper)` |
| src/styles/global.css | fallback | `var(--ef-ink, #11131D)` | `var(--ef-ink)` |
| src/styles/global.css | fallback | `var(--ef-figure, #FFFFFF)` | `var(--ef-figure)` |
| src/styles/global.css | fallback | `var(--ef-ink, #11131D)` | `var(--ef-ink)` |
| src/styles/global.css | fallback | `var(--ef-ink, #11131D)` | `var(--ef-ink)` |
| src/styles/global.css | fallback | `var(--ef-paper, #F1F3F2)` | `var(--ef-paper)` |
| src/styles/global.css | fallback | `var(--ef-ink, #11131D)` | `var(--ef-ink)` |
| src/styles/global.css | fallback | `var(--ef-paper, #F1F3F2)` | `var(--ef-paper)` |
| src/styles/global.css | fallback | `var(--ef-signal, #3156E8)` | `var(--ef-signal)` |
| src/styles/global.css | fallback | `var(--ef-signal, #3156E8)` | `var(--ef-signal)` |
| src/styles/global.css | fallback | `var(--ef-ink, #11131D)` | `var(--ef-ink)` |
| src/styles/global.css | fallback | `var(--ef-teal, #28706B)` | `var(--ef-teal)` |
| src/styles/global.css | fallback | `var(--ef-teal, #28706B)` | `var(--ef-teal)` |
| src/styles/global.css | fallback | `var(--ef-paper, #F1F3F2)` | `var(--ef-paper)` |
| src/styles/global.css | fallback | `var(--ef-signal, #3156E8)` | `var(--ef-signal)` |
| src/styles/global.css | fallback | `var(--ef-teal, #28706B)` | `var(--ef-teal)` |
| src/styles/global.css | fallback | `var(--ef-ink, #11131D)` | `var(--ef-ink)` |
| src/styles/global.css | fallback | `var(--ef-paper, #F1F3F2)` | `var(--ef-paper)` |
| src/styles/global.css | fallback | `var(--ef-ink, #11131D)` | `var(--ef-ink)` |
| src/styles/global.css | fallback | `var(--ef-paper, #F1F3F2)` | `var(--ef-paper)` |
| src/styles/global.css | fallback | `var(--ef-ink, #11131D)` | `var(--ef-ink)` |
| src/styles/global.css | fallback | `var(--ef-paper, #F1F3F2)` | `var(--ef-paper)` |
| src/styles/global.css | fallback | `var(--ef-teal, #28706B)` | `var(--ef-teal)` |
| src/styles/global.css | alpha | `rgba(16, 42, 67, 0.05)` | `color-mix(in srgb, var(--p-blue-16) 5%, transparent)` |
| src/styles/global.css | alpha | `rgba(16, 42, 67, 0.05)` | `color-mix(in srgb, var(--p-blue-16) 5%, transparent)` |
| src/styles/global.css | alpha | `rgba(16, 42, 67, 0.12)` | `color-mix(in srgb, var(--p-blue-16) 12%, transparent)` |
| src/styles/global.css | primitive | `#ecd79e` | `var(--p-gold-86)` |
| src/styles/global.css | alpha | `rgba(16, 42, 67, 0.06)` | `color-mix(in srgb, var(--p-blue-16) 6%, transparent)` |
| src/styles/global.css | alpha | `rgba(185, 178, 163, 0.7)` | `color-mix(in srgb, var(--p-gold-73) 70%, transparent)` |
| src/styles/global.css | alpha | `rgba(251, 250, 246, 0.92)` | `color-mix(in srgb, var(--p-neutral-99) 92%, transparent)` |
| src/styles/global.css | alpha | `rgba(243, 204, 120, 0.18)` | `color-mix(in srgb, var(--p-gold-84) 18%, transparent)` |
| src/styles/global.css | alpha | `rgba(213, 166, 59, 0.14)` | `color-mix(in srgb, var(--p-gold-71) 14%, transparent)` |
| src/styles/global.css | alpha | `rgba(243, 204, 120, 0.42)` | `color-mix(in srgb, var(--p-gold-84) 42%, transparent)` |
| src/styles/global.css | alpha | `rgba(243, 204, 120, 0.34)` | `color-mix(in srgb, var(--p-gold-84) 34%, transparent)` |
| src/styles/global.css | alpha | `rgba(243, 204, 120, 0.34)` | `color-mix(in srgb, var(--p-gold-84) 34%, transparent)` |
| src/styles/global.css | alpha | `rgba(16, 42, 67, 0.14)` | `color-mix(in srgb, var(--p-blue-16) 14%, transparent)` |
| src/styles/global.css | alpha | `rgba(135, 57, 31, 0.2)` | `color-mix(in srgb, var(--p-red-34) 20%, transparent)` |
| src/styles/global.css | alpha | `rgba(16, 42, 67, 0.035)` | `color-mix(in srgb, var(--p-blue-16) 3.5%, transparent)` |
| src/styles/global.css | alpha | `rgba(16, 42, 67, 0.035)` | `color-mix(in srgb, var(--p-blue-16) 3.5%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.42)` | `color-mix(in srgb, var(--p-figure) 42%, transparent)` |
| src/styles/global.css | alpha | `rgba(181, 79, 45, 0.16)` | `color-mix(in srgb, var(--p-red-46b) 16%, transparent)` |
| src/styles/global.css | alpha | `rgba(181, 79, 45, 0.035)` | `color-mix(in srgb, var(--p-red-46b) 3.5%, transparent)` |
| src/styles/global.css | alpha | `rgba(23, 107, 106, 0.025)` | `color-mix(in srgb, var(--p-teal-41b) 2.5%, transparent)` |
| src/styles/global.css | alpha | `rgba(16, 42, 67, 0.98)` | `color-mix(in srgb, var(--p-blue-16) 98%, transparent)` |
| src/styles/global.css | alpha | `rgba(18, 60, 78, 0.95)` | `color-mix(in srgb, var(--p-blue-23) 95%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.1)` | `color-mix(in srgb, var(--p-figure) 10%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.025)` | `color-mix(in srgb, var(--p-figure) 2.5%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.018)` | `color-mix(in srgb, var(--p-figure) 1.8%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.09)` | `color-mix(in srgb, var(--p-figure) 9%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.09)` | `color-mix(in srgb, var(--p-figure) 9%, transparent)` |
| src/styles/global.css | alpha | `rgba(0, 0, 0, 0.2)` | `color-mix(in srgb, var(--p-neutral-00) 20%, transparent)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | primitive | `#d9e7ef` | `var(--p-neutral-91)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.36)` | `color-mix(in srgb, var(--p-figure) 36%, transparent)` |
| src/styles/global.css | primitive | `#aebfcb` | `var(--p-blue-76b)` |
| src/styles/global.css | alpha | `rgba(217, 231, 239, 0.62)` | `color-mix(in srgb, var(--p-neutral-91) 62%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.17)` | `color-mix(in srgb, var(--p-figure) 17%, transparent)` |
| src/styles/global.css | alpha | `rgba(243, 204, 120, 0.26)` | `color-mix(in srgb, var(--p-gold-84) 26%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.12)` | `color-mix(in srgb, var(--p-figure) 12%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.08)` | `color-mix(in srgb, var(--p-figure) 8%, transparent)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | alpha | `rgba(217, 231, 239, 0.66)` | `color-mix(in srgb, var(--p-neutral-91) 66%, transparent)` |
| src/styles/global.css | alpha | `rgba(0, 0, 0, 0.24)` | `color-mix(in srgb, var(--p-neutral-00) 24%, transparent)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | alpha | `rgba(16, 42, 67, 0.45)` | `color-mix(in srgb, var(--p-blue-16) 45%, transparent)` |
| src/styles/global.css | alpha | `rgba(243, 204, 120, 0.14)` | `color-mix(in srgb, var(--p-gold-84) 14%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.7)` | `color-mix(in srgb, var(--p-figure) 70%, transparent)` |
| src/styles/global.css | primitive | `#cfdae3` | `var(--p-neutral-86)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | primitive | `#cfdae3` | `var(--p-neutral-86)` |
| src/styles/global.css | primitive | `#d4e0e8` | `var(--p-neutral-89b)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | alpha | `rgba(181, 79, 45, 0.18)` | `color-mix(in srgb, var(--p-red-46b) 18%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.72)` | `color-mix(in srgb, var(--p-figure) 72%, transparent)` |
| src/styles/global.css | primitive | `#ecd79e` | `var(--p-gold-86)` |
| src/styles/global.css | primitive | `#cfdae3` | `var(--p-neutral-86)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | primitive | `#a24828` | `var(--p-red-42)` |
| src/styles/global.css | primitive | `#70402d` | `var(--p-red-32)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.2)` | `color-mix(in srgb, var(--p-figure) 20%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.04)` | `color-mix(in srgb, var(--p-figure) 4%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.03)` | `color-mix(in srgb, var(--p-figure) 3%, transparent)` |
| src/styles/global.css | primitive | `#f7e8df` | `var(--p-neutral-93c)` |
| src/styles/global.css | primitive | `#c5d2dc` | `var(--p-neutral-84b)` |
| src/styles/global.css | primitive | `#0c2235` | `var(--p-blue-12)` |
| src/styles/global.css | primitive | `#91a8b9` | `var(--p-blue-68b)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | primitive | `#c5d2dc` | `var(--p-neutral-84b)` |
| src/styles/global.css | primitive | `#7f98aa` | `var(--p-blue-62)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.12)` | `color-mix(in srgb, var(--p-figure) 12%, transparent)` |
| src/styles/global.css | primitive | `#a9bdca` | `var(--p-blue-76b)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | alpha | `rgba(23, 107, 106, 0.34)` | `color-mix(in srgb, var(--p-teal-41b) 34%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.035)` | `color-mix(in srgb, var(--p-figure) 3.5%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.035)` | `color-mix(in srgb, var(--p-figure) 3.5%, transparent)` |
| src/styles/global.css | primitive | `#0c2235` | `var(--p-blue-12)` |
| src/styles/global.css | alpha | `rgba(16, 42, 67, 0.8)` | `color-mix(in srgb, var(--p-blue-16) 80%, transparent)` |
| src/styles/global.css | alpha | `rgba(16, 42, 67, 0.2)` | `color-mix(in srgb, var(--p-blue-16) 20%, transparent)` |
| src/styles/global.css | alpha | `rgba(243, 204, 120, 0.09)` | `color-mix(in srgb, var(--p-gold-84) 9%, transparent)` |
| src/styles/global.css | alpha | `rgba(243, 204, 120, 0.025)` | `color-mix(in srgb, var(--p-gold-84) 2.5%, transparent)` |
| src/styles/global.css | alpha | `rgba(243, 204, 120, 0.018)` | `color-mix(in srgb, var(--p-gold-84) 1.8%, transparent)` |
| src/styles/global.css | primitive | `#91a8b9` | `var(--p-blue-68b)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.12)` | `color-mix(in srgb, var(--p-figure) 12%, transparent)` |
| src/styles/global.css | primitive | `#b9d8d5` | `var(--p-teal-84)` |
| src/styles/global.css | primitive | `#74c69d` | `var(--p-green-74)` |
| src/styles/global.css | alpha | `rgba(116, 198, 157, 0.1)` | `color-mix(in srgb, var(--p-green-74) 10%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.22)` | `color-mix(in srgb, var(--p-figure) 22%, transparent)` |
| src/styles/global.css | alpha | `rgba(243, 204, 120, 0.35)` | `color-mix(in srgb, var(--p-gold-84) 35%, transparent)` |
| src/styles/global.css | primitive | `#91a8b9` | `var(--p-blue-68b)` |
| src/styles/global.css | primitive | `#0c2235` | `var(--p-blue-12)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.34)` | `color-mix(in srgb, var(--p-figure) 34%, transparent)` |
| src/styles/global.css | primitive | `#0c2235` | `var(--p-blue-12)` |
| src/styles/global.css | primitive | `#0c2235` | `var(--p-blue-12)` |
| src/styles/global.css | alpha | `rgba(243, 204, 120, 0.1)` | `color-mix(in srgb, var(--p-gold-84) 10%, transparent)` |
| src/styles/global.css | alpha | `rgba(243, 204, 120, 0.24)` | `color-mix(in srgb, var(--p-gold-84) 24%, transparent)` |
| src/styles/global.css | alpha | `rgba(16, 42, 67, 0.035)` | `color-mix(in srgb, var(--p-blue-16) 3.5%, transparent)` |
| src/styles/global.css | alpha | `rgba(243, 204, 120, 0.22)` | `color-mix(in srgb, var(--p-gold-84) 22%, transparent)` |
| src/styles/global.css | alpha | `rgba(181, 79, 45, 0.45)` | `color-mix(in srgb, var(--p-red-46b) 45%, transparent)` |
| src/styles/global.css | alpha | `rgba(217, 231, 239, 0.55)` | `color-mix(in srgb, var(--p-neutral-91) 55%, transparent)` |
| src/styles/global.css | alpha | `rgba(217, 231, 239, 0.2)` | `color-mix(in srgb, var(--p-neutral-91) 20%, transparent)` |
| src/styles/global.css | primitive | `#d4e0e8` | `var(--p-neutral-89b)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.025)` | `color-mix(in srgb, var(--p-figure) 2.5%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.025)` | `color-mix(in srgb, var(--p-figure) 2.5%, transparent)` |
| src/styles/global.css | primitive | `#102a43` | `var(--p-blue-16)` |
| src/styles/global.css | alpha | `rgba(16, 42, 67, 0.8)` | `color-mix(in srgb, var(--p-blue-16) 80%, transparent)` |
| src/styles/global.css | alpha | `rgba(213, 166, 59, 0.7)` | `color-mix(in srgb, var(--p-gold-71) 70%, transparent)` |
| src/styles/global.css | alpha | `rgba(16, 42, 67, 0.19)` | `color-mix(in srgb, var(--p-blue-16) 19%, transparent)` |
| src/styles/global.css | alpha | `rgba(181, 79, 45, 0.14)` | `color-mix(in srgb, var(--p-red-46b) 14%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.025)` | `color-mix(in srgb, var(--p-figure) 2.5%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.025)` | `color-mix(in srgb, var(--p-figure) 2.5%, transparent)` |
| src/styles/global.css | primitive | `#0c2235` | `var(--p-blue-12)` |
| src/styles/global.css | primitive | `#7f98aa` | `var(--p-blue-62)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.11)` | `color-mix(in srgb, var(--p-figure) 11%, transparent)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | primitive | `#aec0cd` | `var(--p-blue-76b)` |
| src/styles/global.css | primitive | `#7f98aa` | `var(--p-blue-62)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.09)` | `color-mix(in srgb, var(--p-figure) 9%, transparent)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | primitive | `#0c2235` | `var(--p-blue-12)` |
| src/styles/global.css | alpha | `rgba(243, 204, 120, 0.38)` | `color-mix(in srgb, var(--p-gold-84) 38%, transparent)` |
| src/styles/global.css | primitive | `#176b6a` | `var(--p-teal-41b)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.28)` | `color-mix(in srgb, var(--p-figure) 28%, transparent)` |
| src/styles/global.css | alpha | `rgba(181, 79, 45, 0.8)` | `color-mix(in srgb, var(--p-red-46b) 80%, transparent)` |
| src/styles/global.css | alpha | `rgba(23, 107, 106, 0.27)` | `color-mix(in srgb, var(--p-teal-41b) 27%, transparent)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | primitive | `#102a43` | `var(--p-blue-16)` |
| src/styles/global.css | alpha | `rgba(243, 204, 120, 0.34)` | `color-mix(in srgb, var(--p-gold-84) 34%, transparent)` |
| src/styles/global.css | alpha | `rgba(243, 204, 120, 0.53)` | `color-mix(in srgb, var(--p-gold-84) 53%, transparent)` |
| src/styles/global.css | alpha | `rgba(23, 107, 106, 0.28)` | `color-mix(in srgb, var(--p-teal-41b) 28%, transparent)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.13)` | `color-mix(in srgb, var(--p-figure) 13%, transparent)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | alpha | `rgba(181, 79, 45, 0.27)` | `color-mix(in srgb, var(--p-red-46b) 27%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.025)` | `color-mix(in srgb, var(--p-figure) 2.5%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.025)` | `color-mix(in srgb, var(--p-figure) 2.5%, transparent)` |
| src/styles/global.css | primitive | `#0c2235` | `var(--p-blue-12)` |
| src/styles/global.css | primitive | `#7f98aa` | `var(--p-blue-62)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.12)` | `color-mix(in srgb, var(--p-figure) 12%, transparent)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | primitive | `#aec0cd` | `var(--p-blue-76b)` |
| src/styles/global.css | primitive | `#c5d2dc` | `var(--p-neutral-84b)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.035)` | `color-mix(in srgb, var(--p-figure) 3.5%, transparent)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.12)` | `color-mix(in srgb, var(--p-figure) 12%, transparent)` |
| src/styles/global.css | primitive | `#7f98aa` | `var(--p-blue-62)` |
| src/styles/global.css | alpha | `rgba(243, 204, 120, 0.4)` | `color-mix(in srgb, var(--p-gold-84) 40%, transparent)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | primitive | `#f3cc78` | `var(--p-gold-84)` |
| src/styles/global.css | alpha | `rgba(213, 166, 59, 0.13)` | `color-mix(in srgb, var(--p-gold-71) 13%, transparent)` |
| src/styles/global.css | alpha | `rgba(243, 204, 120, 0.24)` | `color-mix(in srgb, var(--p-gold-84) 24%, transparent)` |
| src/styles/global.css | alpha | `rgba(16, 42, 67, 0.17)` | `color-mix(in srgb, var(--p-blue-16) 17%, transparent)` |
| src/styles/global.css | primitive | `#6d8799` | `var(--p-blue-55b)` |
| src/styles/global.css | primitive | `#000` | `var(--p-neutral-00)` |
| src/styles/global.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/global.css | primitive | `#000` | `var(--p-neutral-00)` |
| src/styles/global.css | alpha | `rgba(255, 255, 255, 0.55)` | `color-mix(in srgb, var(--p-figure) 55%, transparent)` |
| src/styles/global.css | alpha | `rgba(17, 17, 19, 0.12)` | `color-mix(in srgb, var(--p-neutral-05) 12%, transparent)` |
| src/styles/global.css | primitive | `#66666c` | `var(--p-neutral-44)` |
| src/styles/global.css | primitive | `#2852e8` | `var(--p-blue-42)` |
| src/styles/global.css | alpha | `rgba(40, 82, 232, 0.16)` | `color-mix(in srgb, var(--p-blue-42) 16%, transparent)` |
| src/styles/homepage-studio.css | role | `#fafafa` | `var(--surface-raised)` |
| src/styles/homepage-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/homepage-studio.css | primitive | `#6b6b6b` | `var(--p-neutral-45b)` |
| src/styles/homepage-studio.css | primitive | `#d4d4d4` | `var(--p-neutral-85)` |
| src/styles/homepage-studio.css | primitive | `#2f2f2f` | `var(--p-neutral-21)` |
| src/styles/homepage-studio.css | primitive | `#b8b8b8` | `var(--p-neutral-76b)` |
| src/styles/homepage-studio.css | primitive | `#7b7b7b` | `var(--p-neutral-50)` |
| src/styles/homepage-studio.css | role | `white` | `var(--surface-raised)` |
| src/styles/homepage-studio.css | primitive | `#7d7d7d` | `var(--p-neutral-52)` |
| src/styles/homepage-studio.css | primitive | `#969696` | `var(--p-neutral-62b)` |
| src/styles/homepage-studio.css | primitive | `#6c6c6c` | `var(--p-neutral-45b)` |
| src/styles/homepage-studio.css | primitive | `#787878` | `var(--p-neutral-50)` |
| src/styles/homepage-studio.css | role | `#f6f6f6` | `var(--surface)` |
| src/styles/homepage-studio.css | primitive | `#4f4f4f` | `var(--p-neutral-34)` |
| src/styles/homepage-studio.css | primitive | `#adadad` | `var(--p-neutral-70)` |
| src/styles/homepage-studio.css | primitive | `#6e6e6e` | `var(--p-neutral-45b)` |
| src/styles/homepage-studio.css | primitive | `#d3d3d3` | `var(--p-neutral-85)` |
| src/styles/homepage-studio.css | alpha | `#34343414` | `color-mix(in srgb, var(--p-neutral-21) 7.8%, transparent)` |
| src/styles/homepage-studio.css | role | `white` | `var(--surface-raised)` |
| src/styles/homepage-studio.css | alpha | `#212121ad` | `color-mix(in srgb, var(--p-neutral-13) 67.8%, transparent)` |
| src/styles/homepage-studio.css | primitive | `#606060` | `var(--p-neutral-41)` |
| src/styles/homepage-studio.css | alpha | `#59595935` | `color-mix(in srgb, var(--p-neutral-36) 20.8%, transparent)` |
| src/styles/homepage-studio.css | primitive | `#777777` | `var(--p-neutral-50)` |
| src/styles/homepage-studio.css | primitive | `#ececec` | `var(--p-neutral-93d)` |
| src/styles/homepage-studio.css | primitive | `#7c7c7c` | `var(--p-neutral-52)` |
| src/styles/homepage-studio.css | primitive | `#747474` | `var(--p-neutral-50)` |
| src/styles/homepage-studio.css | role | `#fcfcfc` | `var(--surface-raised)` |
| src/styles/homepage-studio.css | primitive | `#808080` | `var(--p-neutral-52)` |
| src/styles/homepage-studio.css | primitive | `#6c6c6c` | `var(--p-neutral-45b)` |
| src/styles/homepage-studio.css | primitive | `#797979` | `var(--p-neutral-50)` |
| src/styles/homepage-studio.css | primitive | `#b5b5b5` | `var(--p-neutral-74)` |
| src/styles/homepage-studio.css | primitive | `#717171` | `var(--p-neutral-48)` |
| src/styles/homepage-studio.css | primitive | `#d5d5d5` | `var(--p-neutral-85)` |
| src/styles/homepage-studio.css | primitive | `#bababa` | `var(--p-neutral-76b)` |
| src/styles/homepage-studio.css | primitive | `#c6c6c6` | `var(--p-neutral-81)` |
| src/styles/homepage-studio.css | primitive | `#eeeeee` | `var(--p-neutral-93d)` |
| src/styles/homepage-studio.css | primitive | `#b6b6b6` | `var(--p-neutral-74)` |
| src/styles/homepage-studio.css | primitive | `#dedede` | `var(--p-neutral-88c)` |
| src/styles/homepage-studio.css | primitive | `#a8a8a8` | `var(--p-neutral-70)` |
| src/styles/homepage-studio.css | primitive | `#e8e8e8` | `var(--p-neutral-93d)` |
| src/styles/homepage-studio.css | primitive | `#7e7e7e` | `var(--p-neutral-52)` |
| src/styles/homepage-studio.css | primitive | `#848484` | `var(--p-neutral-55)` |
| src/styles/homepage-studio.css | primitive | `#eaeaea` | `var(--p-neutral-93d)` |
| src/styles/homepage-studio.css | primitive | `#6e6e6e` | `var(--p-neutral-48)` |
| src/styles/homepage-studio.css | primitive | `#838383` | `var(--p-neutral-55)` |
| src/styles/homepage-studio.css | primitive | `#717171` | `var(--p-neutral-48)` |
| src/styles/homepage-studio.css | role | `#f1f1f1` | `var(--surface)` |
| src/styles/homepage-studio.css | primitive | `#bcbcbc` | `var(--p-neutral-76b)` |
| src/styles/homepage-studio.css | primitive | `#c1c1c1` | `var(--p-neutral-78b)` |
| src/styles/homepage-studio.css | primitive | `#9d9d9d` | `var(--p-neutral-65)` |
| src/styles/homepage-studio.css | primitive | `#757575` | `var(--p-neutral-50)` |
| src/styles/homepage-studio.css | primitive | `#ececec` | `var(--p-neutral-93d)` |
| src/styles/homepage-studio.css | primitive | `#f9f9f9` | `var(--p-neutral-98)` |
| src/styles/homepage-studio.css | primitive | `#c5c5c5` | `var(--p-neutral-81)` |
| src/styles/homepage-studio.css | primitive | `#7d7d7d` | `var(--p-neutral-52)` |
| src/styles/homepage-studio.css | primitive | `#747474` | `var(--p-neutral-50)` |
| src/styles/homepage-studio.css | primitive | `#7d7d7d` | `var(--p-neutral-52)` |
| src/styles/homepage-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/homepage-studio.css | primitive | `#fafafa` | `var(--p-neutral-98)` |
| src/styles/homepage-studio.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/homepage-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/homepage-studio.css | primitive | `#555` | `var(--p-neutral-36)` |
| src/styles/homepage-studio.css | primitive | `#555` | `var(--p-neutral-36)` |
| src/styles/homepage-studio.css | primitive | `#666` | `var(--p-neutral-43)` |
| src/styles/homepage-studio.css | primitive | `#fafafa` | `var(--p-neutral-98)` |
| src/styles/homepage-studio.css | primitive | `#fafafa` | `var(--p-neutral-98)` |
| src/styles/homepage-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/homepage-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/homepage-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/homepage-studio.css | primitive | `#666` | `var(--p-neutral-43)` |
| src/styles/homepage-studio.css | primitive | `#000` | `var(--p-neutral-00)` |
| src/styles/homepage-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/homepage-studio.css | primitive | `#151515` | `var(--p-neutral-08b)` |
| src/styles/homepage-studio.css | role | `#f5f5f5` | `var(--surface)` |
| src/styles/homepage-studio.css | role | `#f5f5f5` | `var(--surface)` |
| src/styles/homepage-studio.css | alpha | `#ffffff25` | `color-mix(in srgb, var(--p-figure) 14.5%, transparent)` |
| src/styles/homepage-studio.css | primitive | `#aaa` | `var(--p-neutral-70)` |
| src/styles/homepage-studio.css | primitive | `#ddd` | `var(--p-neutral-88c)` |
| src/styles/homepage-studio.css | role | `#f5f5f5` | `var(--surface)` |
| src/styles/homepage-studio.css | primitive | `#bcbcbc` | `var(--p-neutral-76b)` |
| src/styles/homepage-studio.css | primitive | `#999` | `var(--p-neutral-62b)` |
| src/styles/homepage-studio.css | alpha | `#ffffff25` | `color-mix(in srgb, var(--p-figure) 14.5%, transparent)` |
| src/styles/homepage-studio.css | primitive | `#ccc` | `var(--p-neutral-81)` |
| src/styles/homepage-studio.css | alpha | `#ffffff35` | `color-mix(in srgb, var(--p-figure) 20.8%, transparent)` |
| src/styles/homepage-studio.css | role | `#f0f0f0` | `var(--surface)` |
| src/styles/homepage-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/homepage-studio.css | primitive | `#aaa` | `var(--p-neutral-70)` |
| src/styles/homepage-studio.css | primitive | `#666` | `var(--p-neutral-43)` |
| src/styles/homepage-studio.css | primitive | `#bbb` | `var(--p-neutral-76b)` |
| src/styles/homepage-studio.css | primitive | `#bbb` | `var(--p-neutral-76b)` |
| src/styles/homepage-studio.css | primitive | `#666` | `var(--p-neutral-43)` |
| src/styles/homepage-studio.css | primitive | `#d4d4d4` | `var(--p-neutral-85)` |
| src/styles/homepage-studio.css | role | `#f1f1f1` | `var(--surface)` |
| src/styles/homepage-studio.css | primitive | `#777` | `var(--p-neutral-50)` |
| src/styles/homepage-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/homepage-studio.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/homepage-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/homepage-studio.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/homepage-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/homepage-studio.css | primitive | `#aaa` | `var(--p-neutral-70)` |
| src/styles/homepage-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/homepage-studio.css | primitive | `#bcbcbc` | `var(--p-neutral-76b)` |
| src/styles/homepage-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/homepage-studio.css | primitive | `#fafafa` | `var(--p-neutral-98)` |
| src/styles/homepage-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/homepage-studio.css | alpha | `#fafafaf5` | `color-mix(in srgb, var(--p-neutral-98) 96.1%, transparent)` |
| src/styles/homepage-studio.css | primitive | `#d4d4d4` | `var(--p-neutral-85)` |
| src/styles/homepage-studio.css | primitive | `#aaa` | `var(--p-neutral-70)` |
| src/styles/homepage-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/homepage-studio.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/instrument.css | fallback | `var(--ef-ink, #11131D)` | `var(--ef-ink)` |
| src/styles/instrument.css | fallback | `var(--ef-ink, #11131D)` | `var(--ef-ink)` |
| src/styles/instrument.css | fallback | `var(--ef-ink, #11131D)` | `var(--ef-ink)` |
| src/styles/instrument.css | fallback | `var(--ef-paper, #F1F3F2)` | `var(--ef-paper)` |
| src/styles/instrument.css | fallback | `var(--ef-figure, #FFFFFF)` | `var(--ef-figure)` |
| src/styles/instrument.css | fallback | `var(--ef-ink, #11131D)` | `var(--ef-ink)` |
| src/styles/instrument.css | fallback | `var(--ef-paper, #F1F3F2)` | `var(--ef-paper)` |
| src/styles/instrument.css | fallback | `var(--ef-ink, #11131D)` | `var(--ef-ink)` |
| src/styles/instrument.css | fallback | `var(--ef-paper, #F1F3F2)` | `var(--ef-paper)` |
| src/styles/instrument.css | fallback | `var(--ef-ink, #11131D)` | `var(--ef-ink)` |
| src/styles/instrument.css | fallback | `var(--ef-paper, #F1F3F2)` | `var(--ef-paper)` |
| src/styles/instrument.css | fallback | `var(--ef-signal, #3156E8)` | `var(--ef-signal)` |
| src/styles/instrument.css | fallback | `var(--ef-signal, #3156E8)` | `var(--ef-signal)` |
| src/styles/instrument.css | fallback | `var(--ef-ink, #11131D)` | `var(--ef-ink)` |
| src/styles/instrument.css | fallback | `var(--ef-ink, #11131D)` | `var(--ef-ink)` |
| src/styles/instrument.css | fallback | `var(--ef-paper, #F1F3F2)` | `var(--ef-paper)` |
| src/styles/instrument.css | fallback | `var(--ef-ink, #11131D)` | `var(--ef-ink)` |
| src/styles/instrument.css | fallback | `var(--ef-paper, #F1F3F2)` | `var(--ef-paper)` |
| src/styles/instrument.css | fallback | `var(--ef-paper, #F1F3F2)` | `var(--ef-paper)` |
| src/styles/instrument.css | primitive | `#c9c9ce` | `var(--p-neutral-81b)` |
| src/styles/instrument.css | primitive | `#efefed` | `var(--p-neutral-93d)` |
| src/styles/instrument.css | primitive | `#e4e4e1` | `var(--p-neutral-91b)` |
| src/styles/instrument.css | primitive | `#a8a8ae` | `var(--p-neutral-69)` |
| src/styles/instrument.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/instrument.css | alpha | `rgba(9, 9, 11, .12)` | `color-mix(in srgb, var(--p-neutral-03) 12%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(247, 247, 245, .88)` | `color-mix(in srgb, var(--p-neutral-98) 88%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(27, 26, 24, .18)` | `color-mix(in srgb, var(--p-neutral-09b) 18%, transparent)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | alpha | `rgba(255,255,255,.72)` | `color-mix(in srgb, var(--p-figure) 72%, transparent)` |
| src/styles/instrument.css | primitive | `#c8d0df` | `var(--p-blue-84)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.2)` | `color-mix(in srgb, var(--p-neutral-95) 20%, transparent)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#bcb7af` | `var(--p-neutral-75)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | alpha | `rgba(27,26,24,.1)` | `color-mix(in srgb, var(--p-neutral-09b) 10%, transparent)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#9b978f` | `var(--p-neutral-63)` |
| src/styles/instrument.css | primitive | `#c3bfb7` | `var(--p-neutral-77b)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.42)` | `color-mix(in srgb, var(--p-neutral-95) 42%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.26)` | `color-mix(in srgb, var(--p-neutral-95) 26%, transparent)` |
| src/styles/instrument.css | primitive | `#99958e` | `var(--p-neutral-63)` |
| src/styles/instrument.css | primitive | `#b8c8ff` | `var(--p-blue-81)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#9cb3ff` | `var(--p-blue-74)` |
| src/styles/instrument.css | primitive | `#66625d` | `var(--p-neutral-42b)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#99958e` | `var(--p-neutral-63)` |
| src/styles/instrument.css | primitive | `#a8a49d` | `var(--p-neutral-68)` |
| src/styles/instrument.css | primitive | `#55524e` | `var(--p-neutral-35)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#d8d4cd` | `var(--p-neutral-84)` |
| src/styles/instrument.css | primitive | `#4c4945` | `var(--p-neutral-31)` |
| src/styles/instrument.css | primitive | `#817d76` | `var(--p-neutral-53)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.26)` | `color-mix(in srgb, var(--p-neutral-95) 26%, transparent)` |
| src/styles/instrument.css | primitive | `#99958e` | `var(--p-neutral-63)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.11)` | `color-mix(in srgb, var(--p-neutral-95) 11%, transparent)` |
| src/styles/instrument.css | primitive | `#99958e` | `var(--p-neutral-63)` |
| src/styles/instrument.css | primitive | `#c7c2b9` | `var(--p-neutral-77b)` |
| src/styles/instrument.css | primitive | `#a8baff` | `var(--p-blue-77)` |
| src/styles/instrument.css | primitive | `#a8baff` | `var(--p-blue-77)` |
| src/styles/instrument.css | primitive | `#99958e` | `var(--p-neutral-63)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#8f8b84` | `var(--p-neutral-58)` |
| src/styles/instrument.css | primitive | `#55524e` | `var(--p-neutral-35)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#4d4a46` | `var(--p-neutral-31)` |
| src/styles/instrument.css | primitive | `#8f8b84` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#c3bfb7` | `var(--p-neutral-77b)` |
| src/styles/instrument.css | primitive | `#9cb3ff` | `var(--p-blue-74)` |
| src/styles/instrument.css | primitive | `#1b1a18` | `var(--p-neutral-09b)` |
| src/styles/instrument.css | primitive | `#f4efe6` | `var(--p-neutral-95)` |
| src/styles/instrument.css | primitive | `#20655a` | `var(--p-teal-38)` |
| src/styles/instrument.css | primitive | `#33312e` | `var(--p-neutral-20)` |
| src/styles/instrument.css | primitive | `#bf5a3c` | `var(--p-red-50)` |
| src/styles/instrument.css | primitive | `#c28f35` | `var(--p-gold-63)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.45)` | `color-mix(in srgb, var(--p-neutral-95) 45%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.65)` | `color-mix(in srgb, var(--p-neutral-95) 65%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.62)` | `color-mix(in srgb, var(--p-neutral-95) 62%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.82)` | `color-mix(in srgb, var(--p-neutral-95) 82%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.4)` | `color-mix(in srgb, var(--p-neutral-95) 40%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.7)` | `color-mix(in srgb, var(--p-neutral-95) 70%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.45)` | `color-mix(in srgb, var(--p-neutral-95) 45%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.25)` | `color-mix(in srgb, var(--p-neutral-95) 25%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.45)` | `color-mix(in srgb, var(--p-neutral-95) 45%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.65)` | `color-mix(in srgb, var(--p-neutral-95) 65%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.55)` | `color-mix(in srgb, var(--p-neutral-95) 55%, transparent)` |
| src/styles/instrument.css | primitive | `#c9c1b4` | `var(--p-neutral-77)` |
| src/styles/instrument.css | primitive | `#7a746b` | `var(--p-neutral-49)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.65)` | `color-mix(in srgb, var(--p-neutral-95) 65%, transparent)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.55)` | `color-mix(in srgb, var(--p-neutral-95) 55%, transparent)` |
| src/styles/instrument.css | primitive | `#aaa59d` | `var(--p-neutral-68)` |
| src/styles/instrument.css | primitive | `#aaa59d` | `var(--p-neutral-68)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#d7d2ca` | `var(--p-neutral-84)` |
| src/styles/instrument.css | primitive | `#65615c` | `var(--p-neutral-42b)` |
| src/styles/instrument.css | primitive | `#b8b3ab` | `var(--p-neutral-75)` |
| src/styles/instrument.css | primitive | `#65615c` | `var(--p-neutral-42b)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | primitive | `#65615c` | `var(--p-neutral-42b)` |
| src/styles/instrument.css | primitive | `#918d86` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#bdb8b0` | `var(--p-neutral-75)` |
| src/styles/instrument.css | primitive | `#b7b7bd` | `var(--p-neutral-75b)` |
| src/styles/instrument.css | primitive | `#a8a8af` | `var(--p-neutral-69)` |
| src/styles/instrument.css | primitive | `#73737b` | `var(--p-neutral-49b)` |
| src/styles/instrument.css | primitive | `#77777f` | `var(--p-neutral-49b)` |
| src/styles/instrument.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#73737b` | `var(--p-neutral-49b)` |
| src/styles/instrument.css | alpha | `rgba(247,247,245,.14)` | `color-mix(in srgb, var(--p-neutral-98) 14%, transparent)` |
| src/styles/instrument.css | primitive | `#73737b` | `var(--p-neutral-49b)` |
| src/styles/instrument.css | primitive | `#8d8d94` | `var(--p-neutral-59)` |
| src/styles/instrument.css | primitive | `#b7b7bd` | `var(--p-neutral-75b)` |
| src/styles/instrument.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | alpha | `rgba(255,255,255,.72)` | `color-mix(in srgb, var(--p-figure) 72%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(255,255,255,.55)` | `color-mix(in srgb, var(--p-figure) 55%, transparent)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | alpha | `rgba(255,255,255,.9)` | `color-mix(in srgb, var(--p-figure) 90%, transparent)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#56524d` | `var(--p-neutral-35)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#b9b4ac` | `var(--p-neutral-75)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#99958e` | `var(--p-neutral-63)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#77726c` | `var(--p-neutral-49)` |
| src/styles/instrument.css | primitive | `#77726c` | `var(--p-neutral-49)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#bbb6ae` | `var(--p-neutral-75)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#f4efe6` | `var(--p-neutral-95)` |
| src/styles/instrument.css | primitive | `#20655a` | `var(--p-teal-38)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.65)` | `color-mix(in srgb, var(--p-neutral-95) 65%, transparent)` |
| src/styles/instrument.css | primitive | `#f4efe6` | `var(--p-neutral-95)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.82)` | `color-mix(in srgb, var(--p-neutral-95) 82%, transparent)` |
| src/styles/instrument.css | primitive | `#f4efe6` | `var(--p-neutral-95)` |
| src/styles/instrument.css | primitive | `#97938c` | `var(--p-neutral-61)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#bbb6ae` | `var(--p-neutral-75)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#56524d` | `var(--p-neutral-35)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | alpha | `rgba(255,255,255,.75)` | `color-mix(in srgb, var(--p-figure) 75%, transparent)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#93908a` | `var(--p-neutral-61)` |
| src/styles/instrument.css | primitive | `#9fb4ff` | `var(--p-blue-74)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#c6c1b9` | `var(--p-neutral-77b)` |
| src/styles/instrument.css | primitive | `#55514d` | `var(--p-neutral-35)` |
| src/styles/instrument.css | primitive | `#8f8b85` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#9c9891` | `var(--p-neutral-63)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#c2bdb5` | `var(--p-neutral-77b)` |
| src/styles/instrument.css | primitive | `#77726c` | `var(--p-neutral-49)` |
| src/styles/instrument.css | primitive | `#77726c` | `var(--p-neutral-49)` |
| src/styles/instrument.css | primitive | `#77726c` | `var(--p-neutral-49)` |
| src/styles/instrument.css | primitive | `#77726c` | `var(--p-neutral-49)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#bbb6ae` | `var(--p-neutral-75)` |
| src/styles/instrument.css | primitive | `#98938c` | `var(--p-neutral-61)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#bbb6ae` | `var(--p-neutral-75)` |
| src/styles/instrument.css | primitive | `#121426` | `var(--p-blue-07)` |
| src/styles/instrument.css | primitive | `#f2eade` | `var(--p-neutral-93)` |
| src/styles/instrument.css | primitive | `#184f48` | `var(--p-teal-30)` |
| src/styles/instrument.css | primitive | `#30313d` | `var(--p-blue-21)` |
| src/styles/instrument.css | primitive | `#ad4e35` | `var(--p-red-45)` |
| src/styles/instrument.css | primitive | `#d3a14a` | `var(--p-gold-69)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.45)` | `color-mix(in srgb, var(--p-neutral-95) 45%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.63)` | `color-mix(in srgb, var(--p-neutral-95) 63%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.8)` | `color-mix(in srgb, var(--p-neutral-95) 80%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.65)` | `color-mix(in srgb, var(--p-neutral-95) 65%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.86)` | `color-mix(in srgb, var(--p-neutral-95) 86%, transparent)` |
| src/styles/instrument.css | primitive | `#7a746b` | `var(--p-neutral-49)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.3)` | `color-mix(in srgb, var(--p-neutral-95) 30%, transparent)` |
| src/styles/instrument.css | primitive | `#7a746b` | `var(--p-neutral-49)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.76)` | `color-mix(in srgb, var(--p-neutral-95) 76%, transparent)` |
| src/styles/instrument.css | primitive | `#7a746b` | `var(--p-neutral-49)` |
| src/styles/instrument.css | primitive | `#bbb6ae` | `var(--p-neutral-75)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.26)` | `color-mix(in srgb, var(--p-neutral-95) 26%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.2)` | `color-mix(in srgb, var(--p-neutral-95) 20%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.45)` | `color-mix(in srgb, var(--p-neutral-95) 45%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.26)` | `color-mix(in srgb, var(--p-neutral-95) 26%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.26)` | `color-mix(in srgb, var(--p-neutral-95) 26%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.45)` | `color-mix(in srgb, var(--p-neutral-95) 45%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.3)` | `color-mix(in srgb, var(--p-neutral-95) 30%, transparent)` |
| src/styles/instrument.css | primitive | `#56524d` | `var(--p-neutral-35)` |
| src/styles/instrument.css | primitive | `#77726c` | `var(--p-neutral-49)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | alpha | `rgba(27,26,24,.98)` | `color-mix(in srgb, var(--p-neutral-09b) 98%, transparent)` |
| src/styles/instrument.css | primitive | `#5b5751` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | primitive | `#8e8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#c7c2b9` | `var(--p-neutral-77b)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#7b766e` | `var(--p-neutral-49)` |
| src/styles/instrument.css | primitive | `#77726a` | `var(--p-neutral-49)` |
| src/styles/instrument.css | primitive | `#8e8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | primitive | `#aaa59d` | `var(--p-neutral-68)` |
| src/styles/instrument.css | primitive | `#7f7a72` | `var(--p-neutral-53)` |
| src/styles/instrument.css | primitive | `#4e4a45` | `var(--p-neutral-31)` |
| src/styles/instrument.css | primitive | `#d7d2ca` | `var(--p-neutral-84)` |
| src/styles/instrument.css | primitive | `#45423e` | `var(--p-neutral-28)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | primitive | `#9cb3ff` | `var(--p-blue-74)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#99958e` | `var(--p-neutral-63)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#99958e` | `var(--p-neutral-63)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | primitive | `#77726a` | `var(--p-neutral-49)` |
| src/styles/instrument.css | primitive | `#c8c3bb` | `var(--p-neutral-77b)` |
| src/styles/instrument.css | primitive | `#8f8b84` | `var(--p-neutral-58)` |
| src/styles/instrument.css | primitive | `#5b5751` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | primitive | `#5b5751` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | primitive | `#8f8b84` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#c8c3bb` | `var(--p-neutral-77b)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | primitive | `#5b5751` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | primitive | `#8f8b84` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#99958e` | `var(--p-neutral-63)` |
| src/styles/instrument.css | primitive | `#99958e` | `var(--p-neutral-63)` |
| src/styles/instrument.css | primitive | `#5b5751` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | primitive | `#69655f` | `var(--p-neutral-42b)` |
| src/styles/instrument.css | primitive | `#4f4b46` | `var(--p-neutral-31)` |
| src/styles/instrument.css | primitive | `#69655f` | `var(--p-neutral-42b)` |
| src/styles/instrument.css | primitive | `#69655f` | `var(--p-neutral-42b)` |
| src/styles/instrument.css | primitive | `#5b5751` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#252944` | `var(--p-blue-17b)` |
| src/styles/instrument.css | alpha | `rgba(255,255,255,.65)` | `color-mix(in srgb, var(--p-figure) 65%, transparent)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | alpha | `rgba(255,255,255,.7)` | `color-mix(in srgb, var(--p-figure) 70%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(255,255,255,.85)` | `color-mix(in srgb, var(--p-figure) 85%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(255,255,255,.7)` | `color-mix(in srgb, var(--p-figure) 70%, transparent)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#5b5751` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | alpha | `rgba(255,255,255,.7)` | `color-mix(in srgb, var(--p-figure) 70%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(27,26,24,.035)` | `color-mix(in srgb, var(--p-neutral-09b) 3.5%, transparent)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#5a5650` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#625e58` | `var(--p-neutral-42b)` |
| src/styles/instrument.css | primitive | `#a7a29a` | `var(--p-neutral-68)` |
| src/styles/instrument.css | primitive | `#625e58` | `var(--p-neutral-42b)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | primitive | `#393733` | `var(--p-neutral-23)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | primitive | `#aca69d` | `var(--p-neutral-68)` |
| src/styles/instrument.css | primitive | `#757069` | `var(--p-neutral-47)` |
| src/styles/instrument.css | primitive | `#aaa59d` | `var(--p-neutral-68)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#5f5a54` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | primitive | `#aaa59d` | `var(--p-neutral-68)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#5a5650` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#aaa59d` | `var(--p-neutral-68)` |
| src/styles/instrument.css | primitive | `#4e4b46` | `var(--p-neutral-31)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#5a5650` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#aca69d` | `var(--p-neutral-68)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#bcb7af` | `var(--p-neutral-75)` |
| src/styles/instrument.css | primitive | `#77726a` | `var(--p-neutral-47)` |
| src/styles/instrument.css | primitive | `#77726a` | `var(--p-neutral-47)` |
| src/styles/instrument.css | primitive | `#aaa59d` | `var(--p-neutral-68)` |
| src/styles/instrument.css | primitive | `#5a5650` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#aaa59d` | `var(--p-neutral-68)` |
| src/styles/instrument.css | primitive | `#77726a` | `var(--p-neutral-47)` |
| src/styles/instrument.css | primitive | `#5a5650` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | primitive | `#e4dfd7` | `var(--p-neutral-90)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | primitive | `#77726a` | `var(--p-neutral-47)` |
| src/styles/instrument.css | primitive | `#5a5650` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#b9b4ac` | `var(--p-neutral-75)` |
| src/styles/instrument.css | primitive | `#77726a` | `var(--p-neutral-47)` |
| src/styles/instrument.css | primitive | `#77726a` | `var(--p-neutral-47)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | primitive | `#5a5650` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#55514c` | `var(--p-neutral-35)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | primitive | `#4f4c47` | `var(--p-neutral-31)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#77726a` | `var(--p-neutral-47)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#5a5650` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | primitive | `#5a5650` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | primitive | `#c8c3bb` | `var(--p-neutral-77b)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#b9b4ac` | `var(--p-neutral-75)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#5a5650` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#373531` | `var(--p-neutral-23)` |
| src/styles/instrument.css | primitive | `#77726a` | `var(--p-neutral-47)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#5a5650` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | primitive | `#aaa59d` | `var(--p-neutral-68)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | primitive | `#77726a` | `var(--p-neutral-47)` |
| src/styles/instrument.css | primitive | `#5a5650` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | primitive | `#5a5650` | `var(--p-neutral-37b)` |
| src/styles/instrument.css | primitive | `#121426` | `var(--p-blue-07)` |
| src/styles/instrument.css | primitive | `#f2eade` | `var(--p-neutral-93)` |
| src/styles/instrument.css | primitive | `#184f48` | `var(--p-teal-30)` |
| src/styles/instrument.css | primitive | `#d3a14a` | `var(--p-gold-69)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.6)` | `color-mix(in srgb, var(--p-neutral-95) 60%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.78)` | `color-mix(in srgb, var(--p-neutral-95) 78%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.65)` | `color-mix(in srgb, var(--p-neutral-95) 65%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.45)` | `color-mix(in srgb, var(--p-neutral-95) 45%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.4)` | `color-mix(in srgb, var(--p-neutral-95) 40%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.78)` | `color-mix(in srgb, var(--p-neutral-95) 78%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.55)` | `color-mix(in srgb, var(--p-neutral-95) 55%, transparent)` |
| src/styles/instrument.css | primitive | `#57534d` | `var(--p-neutral-35)` |
| src/styles/instrument.css | primitive | `#c9c1b4` | `var(--p-neutral-77)` |
| src/styles/instrument.css | primitive | `#7a746b` | `var(--p-neutral-49)` |
| src/styles/instrument.css | primitive | `#403d39` | `var(--p-neutral-26b)` |
| src/styles/instrument.css | alpha | `rgba(244,239,230,.45)` | `color-mix(in srgb, var(--p-neutral-95) 45%, transparent)` |
| src/styles/instrument.css | alpha | `rgba(247,247,245,.96)` | `color-mix(in srgb, var(--p-neutral-98) 96%, transparent)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | primitive | `#b9b4ac` | `var(--p-neutral-75)` |
| src/styles/instrument.css | primitive | `#55525d` | `var(--p-neutral-36b)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#b9b4ac` | `var(--p-neutral-75)` |
| src/styles/instrument.css | primitive | `#777480` | `var(--p-neutral-49c)` |
| src/styles/instrument.css | primitive | `#777480` | `var(--p-neutral-49c)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#aaa6b0` | `var(--p-neutral-69b)` |
| src/styles/instrument.css | primitive | `#252944` | `var(--p-blue-17b)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#cbc7d0` | `var(--p-neutral-81c)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#777480` | `var(--p-neutral-49c)` |
| src/styles/instrument.css | primitive | `#8f8a83` | `var(--p-neutral-58)` |
| src/styles/instrument.css | role | `white` | `var(--surface-raised)` |
| src/styles/instrument.css | primitive | `#b9b4ac` | `var(--p-neutral-75)` |
| src/styles/instrument.css | primitive | `#777480` | `var(--p-neutral-49c)` |
| src/styles/macroeconomics.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/macroeconomics.css | primitive | `#fafafa` | `var(--p-neutral-98)` |
| src/styles/macroeconomics.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/macroeconomics.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/macroeconomics.css | primitive | `#555` | `var(--p-neutral-36)` |
| src/styles/macroeconomics.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/macroeconomics.css | primitive | `#fafafa` | `var(--p-neutral-98)` |
| src/styles/macroeconomics.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/macroeconomics.css | primitive | `#606060` | `var(--p-neutral-41)` |
| src/styles/macroeconomics.css | primitive | `#d8d8d8` | `var(--p-neutral-87)` |
| src/styles/macroeconomics.css | role | `#3156e8` | `var(--accent)` |
| src/styles/macroeconomics.css | role | `#9e4d38` | `var(--caution)` |
| src/styles/macroeconomics.css | role | `#28706b` | `var(--positive)` |
| src/styles/macroeconomics.css | primitive | `#eee` | `var(--p-neutral-93d)` |
| src/styles/macroeconomics.css | primitive | `#ebebeb` | `var(--p-neutral-93d)` |
| src/styles/macroeconomics.css | primitive | `#f6eeeb` | `var(--p-neutral-95d)` |
| src/styles/macroeconomics.css | primitive | `#e9edff` | `var(--p-blue-94)` |
| src/styles/macroeconomics.css | primitive | `#e9edff` | `var(--p-blue-94)` |
| src/styles/measurement.css | primitive | `#6845b7` | `var(--p-violet-39b)` |
| src/styles/measurement.css | primitive | `#eae6f6` | `var(--p-violet-92)` |
| src/styles/measurement.css | primitive | `#142b49` | `var(--p-blue-17)` |
| src/styles/measurement.css | primitive | `#e7eef9` | `var(--p-neutral-94)` |
| src/styles/measurement.css | primitive | `#edf0f8` | `var(--p-neutral-95c)` |
| src/styles/measurement.css | primitive | `#eae6f6` | `var(--p-violet-92)` |
| src/styles/measurement.css | role | `white` | `var(--surface-raised)` |
| src/styles/measurement.css | role | `white` | `var(--surface-raised)` |
| src/styles/measurement.css | primitive | `#d7e3f6` | `var(--p-blue-90)` |
| src/styles/measurement.css | role | `white` | `var(--surface-raised)` |
| src/styles/measurement.css | primitive | `#eae6f6` | `var(--p-violet-92)` |
| src/styles/measurement.css | role | `white` | `var(--surface-raised)` |
| src/styles/st-louis-atlas.css | alpha | `#ffffff21` | `color-mix(in srgb, var(--p-figure) 12.9%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#bdc8ce` | `var(--p-neutral-80)` |
| src/styles/st-louis-atlas.css | alpha | `#ffffff26` | `color-mix(in srgb, var(--p-figure) 14.9%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#bbcbd1` | `var(--p-neutral-80)` |
| src/styles/st-louis-atlas.css | primitive | `#101c22` | `var(--p-neutral-09c)` |
| src/styles/st-louis-atlas.css | primitive | `#c8e6ee` | `var(--p-blue-89b)` |
| src/styles/st-louis-atlas.css | primitive | `#c8e6ee` | `var(--p-blue-89b)` |
| src/styles/st-louis-atlas.css | primitive | `#b7c6ce` | `var(--p-neutral-80)` |
| src/styles/st-louis-atlas.css | primitive | `#111b20` | `var(--p-neutral-09c)` |
| src/styles/st-louis-atlas.css | primitive | `#edf3f5` | `var(--p-neutral-95e)` |
| src/styles/st-louis-atlas.css | primitive | `#60717c` | `var(--p-blue-47)` |
| src/styles/st-louis-atlas.css | primitive | `#b4c6d0` | `var(--p-blue-79)` |
| src/styles/st-louis-atlas.css | primitive | `#77cbd3` | `var(--p-teal-77)` |
| src/styles/st-louis-atlas.css | primitive | `#dae8b6` | `var(--p-green-90)` |
| src/styles/st-louis-atlas.css | primitive | `#e39759` | `var(--p-gold-69b)` |
| src/styles/st-louis-atlas.css | primitive | `#bb5279` | `var(--p-red-49)` |
| src/styles/st-louis-atlas.css | primitive | `#dae4e9` | `var(--p-neutral-90b)` |
| src/styles/st-louis-atlas.css | primitive | `#a7bcc6` | `var(--p-blue-75)` |
| src/styles/st-louis-atlas.css | alpha | `#ffffff19` | `color-mix(in srgb, var(--p-figure) 9.8%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#d3e0e6` | `var(--p-neutral-89b)` |
| src/styles/st-louis-atlas.css | alpha | `#ffffff15` | `color-mix(in srgb, var(--p-figure) 8.2%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#d9e5ed` | `var(--p-neutral-91)` |
| src/styles/st-louis-atlas.css | primitive | `#e9d2b4` | `var(--p-gold-85)` |
| src/styles/st-louis-atlas.css | primitive | `#9db1bc` | `var(--p-blue-71b)` |
| src/styles/st-louis-atlas.css | alpha | `#c0e3ed0b` | `color-mix(in srgb, var(--p-blue-88b) 4.3%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#b2d6ec` | `var(--p-blue-84c)` |
| src/styles/st-louis-atlas.css | alpha | `#12212aee` | `color-mix(in srgb, var(--p-blue-12b) 93.3%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#eaf1f5` | `var(--p-neutral-95e)` |
| src/styles/st-louis-atlas.css | alpha | `#abc9d033` | `color-mix(in srgb, var(--p-blue-79b) 20%, transparent)` |
| src/styles/st-louis-atlas.css | alpha | `#0003` | `color-mix(in srgb, var(--p-neutral-00) 20%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#b3c8d4` | `var(--p-blue-79)` |
| src/styles/st-louis-atlas.css | primitive | `#c8e6ee` | `var(--p-blue-89b)` |
| src/styles/st-louis-atlas.css | primitive | `#b5c7d2` | `var(--p-blue-79)` |
| src/styles/st-louis-atlas.css | alpha | `#ffffff20` | `color-mix(in srgb, var(--p-figure) 12.5%, transparent)` |
| src/styles/st-louis-atlas.css | alpha | `#ffffff10` | `color-mix(in srgb, var(--p-figure) 6.3%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#b4e3e5` | `var(--p-teal-87)` |
| src/styles/st-louis-atlas.css | primitive | `#e3ebef` | `var(--p-neutral-93e)` |
| src/styles/st-louis-atlas.css | primitive | `#a7bcc8` | `var(--p-blue-75)` |
| src/styles/st-louis-atlas.css | primitive | `#aec2ce` | `var(--p-blue-76b)` |
| src/styles/st-louis-atlas.css | primitive | `#111c22` | `var(--p-neutral-09c)` |
| src/styles/st-louis-atlas.css | primitive | `#e4eff5` | `var(--p-neutral-93e)` |
| src/styles/st-louis-atlas.css | primitive | `#5a6f7c` | `var(--p-blue-46b)` |
| src/styles/st-louis-atlas.css | primitive | `#d0e8f3` | `var(--p-blue-91)` |
| src/styles/st-louis-atlas.css | alpha | `#ffffff14` | `color-mix(in srgb, var(--p-figure) 7.8%, transparent)` |
| src/styles/st-louis-atlas.css | alpha | `#ffffff17` | `color-mix(in srgb, var(--p-figure) 9%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#9fcadd` | `var(--p-blue-79c)` |
| src/styles/st-louis-atlas.css | primitive | `#e3edf2` | `var(--p-neutral-93e)` |
| src/styles/st-louis-atlas.css | primitive | `#a9bdc9` | `var(--p-blue-75)` |
| src/styles/st-louis-atlas.css | alpha | `#b9d8ec0a` | `color-mix(in srgb, var(--p-blue-85b) 3.9%, transparent)` |
| src/styles/st-louis-atlas.css | alpha | `#a6c9da55` | `color-mix(in srgb, var(--p-blue-79d) 33.3%, transparent)` |
| src/styles/st-louis-atlas.css | alpha | `#a0ceea07` | `color-mix(in srgb, var(--p-blue-80) 2.7%, transparent)` |
| src/styles/st-louis-atlas.css | alpha | `#ffffff20` | `color-mix(in srgb, var(--p-figure) 12.5%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#aec3ce` | `var(--p-blue-79)` |
| src/styles/st-louis-atlas.css | alpha | `#d0deea08` | `color-mix(in srgb, var(--p-neutral-88d) 3.1%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#d2e7f2` | `var(--p-blue-91)` |
| src/styles/st-louis-atlas.css | primitive | `#a9bdc9` | `var(--p-blue-75)` |
| src/styles/st-louis-atlas.css | primitive | `#b8dce8` | `var(--p-blue-86b)` |
| src/styles/st-louis-atlas.css | alpha | `#abc9d033` | `color-mix(in srgb, var(--p-blue-79b) 20%, transparent)` |
| src/styles/st-louis-atlas.css | alpha | `#ffffff06` | `color-mix(in srgb, var(--p-figure) 2.4%, transparent)` |
| src/styles/st-louis-atlas.css | alpha | `#ffffff16` | `color-mix(in srgb, var(--p-figure) 8.6%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#a8bfcc` | `var(--p-blue-75)` |
| src/styles/st-louis-atlas.css | alpha | `#c1dce718` | `color-mix(in srgb, var(--p-blue-86c) 9.4%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#ecf4f7` | `var(--p-neutral-95e)` |
| src/styles/st-louis-atlas.css | alpha | `#b8dce837` | `color-mix(in srgb, var(--p-blue-86b) 21.6%, transparent)` |
| src/styles/st-louis-atlas.css | alpha | `#abc5d02b` | `color-mix(in srgb, var(--p-blue-78b) 16.9%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#dfedf3` | `var(--p-neutral-93f)` |
| src/styles/st-louis-atlas.css | alpha | `#abc5d022` | `color-mix(in srgb, var(--p-blue-78b) 13.3%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#c0d4df` | `var(--p-blue-84d)` |
| src/styles/st-louis-atlas.css | primitive | `#111c22` | `var(--p-neutral-09c)` |
| src/styles/st-louis-atlas.css | primitive | `#e4eff5` | `var(--p-neutral-93f)` |
| src/styles/st-louis-atlas.css | primitive | `#5a6f7c` | `var(--p-blue-46b)` |
| src/styles/st-louis-atlas.css | alpha | `#ffffff12` | `color-mix(in srgb, var(--p-figure) 7.1%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#111c22` | `var(--p-neutral-09c)` |
| src/styles/st-louis-atlas.css | primitive | `#e4eff5` | `var(--p-neutral-93f)` |
| src/styles/st-louis-atlas.css | primitive | `#5a6f7c` | `var(--p-blue-46b)` |
| src/styles/st-louis-atlas.css | alpha | `#ffffff1a` | `color-mix(in srgb, var(--p-figure) 10.2%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#b6c9d3` | `var(--p-blue-79)` |
| src/styles/st-louis-atlas.css | alpha | `#ffffff1a` | `color-mix(in srgb, var(--p-figure) 10.2%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#afc6d2` | `var(--p-blue-78b)` |
| src/styles/st-louis-atlas.css | alpha | `#c1dce708` | `color-mix(in srgb, var(--p-blue-86c) 3.1%, transparent)` |
| src/styles/st-louis-atlas.css | alpha | `#ffffff1a` | `color-mix(in srgb, var(--p-figure) 10.2%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#d3e5ec` | `var(--p-neutral-91)` |
| src/styles/st-louis-atlas.css | alpha | `#b8cfe206` | `color-mix(in srgb, var(--p-blue-82) 2.4%, transparent)` |
| src/styles/st-louis-atlas.css | alpha | `#d9a6bf77` | `color-mix(in srgb, var(--p-red-73b) 46.7%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#e0ebf1` | `var(--p-neutral-93f)` |
| src/styles/st-louis-atlas.css | primitive | `#b9a7b0` | `var(--p-red-70)` |
| src/styles/st-louis-atlas.css | alpha | `#ffffff20` | `color-mix(in srgb, var(--p-figure) 12.5%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#c9dae3` | `var(--p-neutral-86b)` |
| src/styles/st-louis-atlas.css | primitive | `#acc4cf` | `var(--p-blue-78b)` |
| src/styles/st-louis-atlas.css | alpha | `#7bc9d308` | `color-mix(in srgb, var(--p-teal-76) 3.1%, transparent)` |
| src/styles/st-louis-atlas.css | alpha | `#b8dce866` | `color-mix(in srgb, var(--p-blue-86b) 40%, transparent)` |
| src/styles/st-louis-atlas.css | alpha | `#101c25ed` | `color-mix(in srgb, var(--p-blue-10) 92.9%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#e0f1f7` | `var(--p-neutral-93f)` |
| src/styles/st-louis-atlas.css | primitive | `#b8dce8` | `var(--p-blue-86b)` |
| src/styles/st-louis-atlas.css | alpha | `#b8dce82b` | `color-mix(in srgb, var(--p-blue-86b) 16.9%, transparent)` |
| src/styles/st-louis-atlas.css | primitive | `#b8dce8` | `var(--p-blue-86b)` |
| src/styles/st-louis-home-search.css | primitive | `#dce7ed` | `var(--p-neutral-90b)` |
| src/styles/st-louis-home-search.css | primitive | `#bfced6` | `var(--p-neutral-82b)` |
| src/styles/st-louis-home-search.css | primitive | `#16232b` | `var(--p-blue-12b)` |
| src/styles/st-louis-home-search.css | alpha | `#ffffff32` | `color-mix(in srgb, var(--p-figure) 19.6%, transparent)` |
| src/styles/st-louis-home-search.css | primitive | `#f3f7f9` | `var(--p-neutral-97)` |
| src/styles/st-louis-home-search.css | primitive | `#aec9d8` | `var(--p-blue-79e)` |
| src/styles/st-louis-home-search.css | alpha | `#ffffff24` | `color-mix(in srgb, var(--p-figure) 14.1%, transparent)` |
| src/styles/st-louis-home-search.css | alpha | `#ffffff2c` | `color-mix(in srgb, var(--p-figure) 17.3%, transparent)` |
| src/styles/st-louis-home-search.css | primitive | `#a9c9e4` | `var(--p-blue-80b)` |
| src/styles/st-louis-home-search.css | alpha | `#ffffff24` | `color-mix(in srgb, var(--p-figure) 14.1%, transparent)` |
| src/styles/st-louis-home-search.css | primitive | `#d3e8f3` | `var(--p-blue-91)` |
| src/styles/st-louis-interface.css | primitive | `#b4c2c6` | `var(--p-neutral-77c)` |
| src/styles/st-louis-interface.css | alpha | `#192329f7` | `color-mix(in srgb, var(--p-neutral-13b) 96.9%, transparent)` |
| src/styles/st-louis-interface.css | alpha | `#b8d1de26` | `color-mix(in srgb, var(--p-blue-82b) 14.9%, transparent)` |
| src/styles/st-louis-interface.css | primitive | `#c8e6ee` | `var(--p-blue-89b)` |
| src/styles/st-louis-interface.css | primitive | `#c8e6ee` | `var(--p-blue-89b)` |
| src/styles/st-louis-interface.css | alpha | `#c8e6ee12` | `color-mix(in srgb, var(--p-blue-89b) 7.1%, transparent)` |
| src/styles/st-louis-interface.css | primitive | `#15262e` | `var(--p-blue-14b)` |
| src/styles/st-louis-interface.css | primitive | `#192329` | `var(--p-neutral-13b)` |
| src/styles/st-louis-interface.css | primitive | `#eef7fb` | `var(--p-neutral-95e)` |
| src/styles/st-louis-interface.css | alpha | `#c8e6ee09` | `color-mix(in srgb, var(--p-blue-89b) 3.5%, transparent)` |
| src/styles/st-louis-interface.css | primitive | `#f1f6f8` | `var(--p-neutral-95e)` |
| src/styles/st-louis-interface.css | alpha | `#c8e6ee09` | `color-mix(in srgb, var(--p-blue-89b) 3.5%, transparent)` |
| src/styles/st-louis-interface.css | alpha | `#111b2080` | `color-mix(in srgb, var(--p-neutral-09c) 50.2%, transparent)` |
| src/styles/st-louis-interface.css | alpha | `#6c859188` | `color-mix(in srgb, var(--p-blue-54) 53.3%, transparent)` |
| src/styles/st-louis-interface.css | primitive | `#101b22` | `var(--p-neutral-09c)` |
| src/styles/st-louis-interface.css | primitive | `#c2d1d9` | `var(--p-neutral-82b)` |
| src/styles/st-louis-interface.css | primitive | `#b8d6e4` | `var(--p-blue-84e)` |
| src/styles/st-louis-interface.css | primitive | `#93acb9` | `var(--p-blue-69c)` |
| src/styles/st-louis-interface.css | primitive | `#d2e1e8` | `var(--p-neutral-89b)` |
| src/styles/st-louis-interface.css | alpha | `#c8e6ee30` | `color-mix(in srgb, var(--p-blue-89b) 18.8%, transparent)` |
| src/styles/st-louis-interface.css | alpha | `#c8e6ee0b` | `color-mix(in srgb, var(--p-blue-89b) 4.3%, transparent)` |
| src/styles/st-louis-interface.css | primitive | `#d2e1e8` | `var(--p-neutral-89b)` |
| src/styles/st-louis-interface.css | primitive | `#a8c6d6` | `var(--p-blue-79e)` |
| src/styles/st-louis-interface.css | alpha | `#c8e6ee1c` | `color-mix(in srgb, var(--p-blue-89b) 11%, transparent)` |
| src/styles/st-louis-interface.css | alpha | `#c8e6ee70` | `color-mix(in srgb, var(--p-blue-89b) 43.9%, transparent)` |
| src/styles/st-louis-interface.css | primitive | `#a8c6d6` | `var(--p-blue-79e)` |
| src/styles/st-louis-interface.css | primitive | `#b9cdd7` | `var(--p-blue-81b)` |
| src/styles/st-louis-interface.css | primitive | `#a8becb` | `var(--p-blue-75)` |
| src/styles/st-louis-interface.css | primitive | `#a8c6d6` | `var(--p-blue-79e)` |
| src/styles/st-louis-interface.css | primitive | `#c8e6ee` | `var(--p-blue-89b)` |
| src/styles/st-louis-interface.css | alpha | `#c8e6ee12` | `color-mix(in srgb, var(--p-blue-89b) 7.1%, transparent)` |
| src/styles/st-louis-interface.css | alpha | `#c8e6ee25` | `color-mix(in srgb, var(--p-blue-89b) 14.5%, transparent)` |
| src/styles/st-louis-map-layers.css | primitive | `#b4c2c6` | `var(--p-neutral-77c)` |
| src/styles/st-louis-map-layers.css | primitive | `#c8e6ee` | `var(--p-blue-89b)` |
| src/styles/st-louis-map-layers.css | primitive | `#a8bfc9` | `var(--p-blue-75)` |
| src/styles/st-louis-map-layers.css | primitive | `#f2f8fa` | `var(--p-neutral-97)` |
| src/styles/st-louis-map-layers.css | primitive | `#b4c9d5` | `var(--p-blue-79)` |
| src/styles/st-louis-map-layers.css | primitive | `#b8d6e4` | `var(--p-blue-84e)` |
| src/styles/st-louis-map-layers.css | primitive | `#b4c2c6` | `var(--p-neutral-77c)` |
| src/styles/st-louis-map-layers.css | primitive | `#101b22` | `var(--p-neutral-09c)` |
| src/styles/st-louis-map-layers.css | alpha | `#b8d6e445` | `color-mix(in srgb, var(--p-blue-84e) 27.1%, transparent)` |
| src/styles/st-louis-map-layers.css | primitive | `#b8d6e4` | `var(--p-blue-84e)` |
| src/styles/st-louis-map-layers.css | primitive | `#dce8ed` | `var(--p-neutral-90b)` |
| src/styles/st-louis-map-layers.css | primitive | `#a8bdc6` | `var(--p-blue-75)` |
| src/styles/st-louis-parcels.css | alpha | `#ffffff1c` | `color-mix(in srgb, var(--p-figure) 11%, transparent)` |
| src/styles/st-louis-parcels.css | primitive | `#ecf1f3` | `var(--p-neutral-95e)` |
| src/styles/st-louis-parcels.css | primitive | `#b3c1c8` | `var(--p-neutral-77c)` |
| src/styles/st-louis-parcels.css | primitive | `#9ecded` | `var(--p-blue-80c)` |
| src/styles/st-louis-parcels.css | primitive | `#667880` | `var(--p-blue-49)` |
| src/styles/st-louis-parcels.css | primitive | `#141d22` | `var(--p-neutral-09c)` |
| src/styles/st-louis-parcels.css | primitive | `#92a7b2` | `var(--p-blue-67b)` |
| src/styles/st-louis-parcels.css | primitive | `#53616b` | `var(--p-blue-40)` |
| src/styles/st-louis-parcels.css | primitive | `#d2dce1` | `var(--p-neutral-87b)` |
| src/styles/st-louis-parcels.css | primitive | `#91bfda` | `var(--p-blue-75b)` |
| src/styles/st-louis-parcels.css | alpha | `#98cced18` | `color-mix(in srgb, var(--p-blue-80c) 9.4%, transparent)` |
| src/styles/st-louis-parcels.css | primitive | `#d6edfc` | `var(--p-blue-93b)` |
| src/styles/st-louis-parcels.css | primitive | `#ccd8df` | `var(--p-neutral-86)` |
| src/styles/st-louis-parcels.css | alpha | `#9ecded55` | `color-mix(in srgb, var(--p-blue-80c) 33.3%, transparent)` |
| src/styles/st-louis-parcels.css | alpha | `#9ecded0e` | `color-mix(in srgb, var(--p-blue-80c) 5.5%, transparent)` |
| src/styles/st-louis-parcels.css | primitive | `#d0e6f4` | `var(--p-blue-91)` |
| src/styles/st-louis-parcels.css | primitive | `#b4c4cf` | `var(--p-blue-79)` |
| src/styles/st-louis-parcels.css | alpha | `#14202680` | `color-mix(in srgb, var(--p-neutral-13b) 50.2%, transparent)` |
| src/styles/st-louis-parcels.css | primitive | `#26333b` | `var(--p-neutral-20b)` |
| src/styles/st-louis-parcels.css | primitive | `#bdcbd3` | `var(--p-neutral-82b)` |
| src/styles/st-louis-parcels.css | alpha | `#a4cff009` | `color-mix(in srgb, var(--p-blue-80c) 3.5%, transparent)` |
| src/styles/st-louis-parcels.css | alpha | `#9ecded18` | `color-mix(in srgb, var(--p-blue-80c) 9.4%, transparent)` |
| src/styles/st-louis-parcels.css | primitive | `#9ecded` | `var(--p-blue-80c)` |
| src/styles/st-louis-parcels.css | alpha | `#9ecded0c` | `color-mix(in srgb, var(--p-blue-80c) 4.7%, transparent)` |
| src/styles/st-louis-parcels.css | primitive | `#a7d4f0` | `var(--p-blue-83b)` |
| src/styles/st-louis-parcels.css | primitive | `#a2b7c2` | `var(--p-blue-75)` |
| src/styles/st-louis-parcels.css | alpha | `#9ecded55` | `color-mix(in srgb, var(--p-blue-80c) 33.3%, transparent)` |
| src/styles/st-louis-parcels.css | primitive | `#e6f4fc` | `var(--p-neutral-95f)` |
| src/styles/st-louis-parcels.css | primitive | `#9ecded` | `var(--p-blue-80c)` |
| src/styles/st-louis-parcels.css | alpha | `#9ecded09` | `color-mix(in srgb, var(--p-blue-80c) 3.5%, transparent)` |
| src/styles/st-louis-parcels.css | primitive | `#bdcbd3` | `var(--p-neutral-82b)` |
| src/styles/st-louis-parcels.css | primitive | `#a7d4f0` | `var(--p-blue-83b)` |
| src/styles/st-louis-proforma.css | primitive | `#b7c5c5` | `var(--p-neutral-78c)` |
| src/styles/st-louis-proforma.css | primitive | `#eac88f` | `var(--p-gold-82)` |
| src/styles/st-louis-proforma.css | primitive | `#eac88f` | `var(--p-gold-82)` |
| src/styles/st-louis-proforma.css | alpha | `#eac88f08` | `color-mix(in srgb, var(--p-gold-82) 3.1%, transparent)` |
| src/styles/st-louis-proforma.css | primitive | `#c1aa80` | `var(--p-gold-71b)` |
| src/styles/st-louis-proforma.css | primitive | `#c9d0ce` | `var(--p-neutral-83c)` |
| src/styles/st-louis-proforma.css | primitive | `#1b2528` | `var(--p-neutral-14)` |
| src/styles/st-louis-proforma.css | primitive | `#c1cecf` | `var(--p-neutral-82c)` |
| src/styles/st-louis-proforma.css | primitive | `#f1eee5` | `var(--p-neutral-95)` |
| src/styles/st-louis-proforma.css | primitive | `#192225` | `var(--p-neutral-14)` |
| src/styles/st-louis-proforma.css | primitive | `#273337` | `var(--p-neutral-20c)` |
| src/styles/st-louis-proforma.css | primitive | `#f0cc93` | `var(--p-gold-82)` |
| src/styles/st-louis-proforma.css | primitive | `#f3a398` | `var(--p-red-75)` |
| src/styles/st-louis-proforma.css | primitive | `#f0c9a4` | `var(--p-gold-83b)` |
| src/styles/st-louis-proforma.css | primitive | `#192225` | `var(--p-neutral-14)` |
| src/styles/st-louis-proforma.css | primitive | `#58656a` | `var(--p-neutral-42c)` |
| src/styles/st-louis-proforma.css | alpha | `#0009` | `color-mix(in srgb, var(--p-neutral-00) 60%, transparent)` |
| src/styles/st-louis-proforma.css | primitive | `#b7c2c1` | `var(--p-neutral-78c)` |
| src/styles/st-louis-proforma.css | primitive | `#f2f1e9` | `var(--p-neutral-95)` |
| src/styles/st-louis-proforma.css | primitive | `#111b1f` | `var(--p-neutral-09c)` |
| src/styles/st-louis-proforma.css | primitive | `#536064` | `var(--p-neutral-40)` |
| src/styles/st-louis-proforma.css | alpha | `#0009` | `color-mix(in srgb, var(--p-neutral-00) 60%, transparent)` |
| src/styles/st-louis-proforma.css | primitive | `#192225` | `var(--p-neutral-14)` |
| src/styles/st-louis-proforma.css | primitive | `#829192` | `var(--p-neutral-59b)` |
| src/styles/st-louis-proforma.css | alpha | `#0005` | `color-mix(in srgb, var(--p-neutral-00) 33.3%, transparent)` |
| src/styles/st-louis-proforma.css | primitive | `#e2c696` | `var(--p-gold-81)` |
| src/styles/st-louis-proforma.css | primitive | `#a88d5b` | `var(--p-gold-60)` |
| src/styles/st-louis-records.css | alpha | `#ffffff1f` | `color-mix(in srgb, var(--p-figure) 12.2%, transparent)` |
| src/styles/st-louis-records.css | primitive | `#b7c5ce` | `var(--p-blue-79)` |
| src/styles/st-louis-records.css | primitive | `#edf3f7` | `var(--p-neutral-95e)` |
| src/styles/st-louis-records.css | primitive | `#b4cee0` | `var(--p-blue-82)` |
| src/styles/st-louis-records.css | primitive | `#e0e8ed` | `var(--p-neutral-93e)` |
| src/styles/st-louis-records.css | primitive | `#19242c` | `var(--p-neutral-13b)` |
| src/styles/st-louis-records.css | alpha | `#a0cff008` | `color-mix(in srgb, var(--p-blue-80c) 3.1%, transparent)` |
| src/styles/st-louis-records.css | alpha | `#8fbdd342` | `color-mix(in srgb, var(--p-blue-74b) 25.9%, transparent)` |
| src/styles/st-louis-records.css | primitive | `#d6edff` | `var(--p-blue-93b)` |
| src/styles/st-louis-records.css | primitive | `#c2cfd7` | `var(--p-neutral-82b)` |
| src/styles/st-louis-records.css | primitive | `#a7c7dd` | `var(--p-blue-79f)` |
| src/styles/st-louis-records.css | primitive | `#badfff` | `var(--p-blue-87)` |
| src/styles/st-louis-records.css | primitive | `#dce7ee` | `var(--p-neutral-91)` |
| src/styles/st-louis-records.css | alpha | `#ffffff0c` | `color-mix(in srgb, var(--p-figure) 4.7%, transparent)` |
| src/styles/st-louis-records.css | alpha | `#ffffff10` | `color-mix(in srgb, var(--p-figure) 6.3%, transparent)` |
| src/styles/st-louis-records.css | alpha | `#ffffff07` | `color-mix(in srgb, var(--p-figure) 2.7%, transparent)` |
| src/styles/st-louis-records.css | primitive | `#badfff` | `var(--p-blue-87)` |
| src/styles/st-louis-records.css | alpha | `#9bbdd43b` | `color-mix(in srgb, var(--p-blue-75c) 23.1%, transparent)` |
| src/styles/st-louis-records.css | alpha | `#9ecded08` | `color-mix(in srgb, var(--p-blue-80c) 3.1%, transparent)` |
| src/styles/st-louis-records.css | alpha | `#9bbdd43b` | `color-mix(in srgb, var(--p-blue-75c) 23.1%, transparent)` |
| src/styles/st-louis-records.css | alpha | `#9ecded05` | `color-mix(in srgb, var(--p-blue-80c) 2%, transparent)` |
| src/styles/st-louis-records.css | primitive | `#badfff` | `var(--p-blue-87)` |
| src/styles/st-louis-records.css | primitive | `#c7d5df` | `var(--p-neutral-84b)` |
| src/styles/st-louis-records.css | primitive | `#9ecded` | `var(--p-blue-80c)` |
| src/styles/st-louis-records.css | primitive | `#edf5ff` | `var(--p-neutral-96b)` |
| src/styles/st-louis-records.css | primitive | `#e4edf5` | `var(--p-neutral-95c)` |
| src/styles/st-louis-records.css | primitive | `#b9c8d1` | `var(--p-blue-79)` |
| src/styles/st-louis-records.css | primitive | `#c7d5df` | `var(--p-neutral-84b)` |
| src/styles/st-louis-records.css | primitive | `#e4eef6` | `var(--p-neutral-95c)` |
| src/styles/st-louis-records.css | alpha | `#ffffff12` | `color-mix(in srgb, var(--p-figure) 7.1%, transparent)` |
| src/styles/st-louis-resident-value.css | primitive | `#dce7ed` | `var(--p-neutral-90b)` |
| src/styles/st-louis-resident-value.css | alpha | `#ffffff24` | `color-mix(in srgb, var(--p-figure) 14.1%, transparent)` |
| src/styles/st-louis-resident-value.css | primitive | `#a6bac5` | `var(--p-blue-75)` |
| src/styles/st-louis-resident-value.css | primitive | `#f3f7fa` | `var(--p-neutral-97)` |
| src/styles/st-louis-resident-value.css | primitive | `#aec9d8` | `var(--p-blue-79e)` |
| src/styles/st-louis-resident-value.css | primitive | `#bfced6` | `var(--p-neutral-82b)` |
| src/styles/st-louis-resident-value.css | primitive | `#16232b` | `var(--p-blue-12b)` |
| src/styles/st-louis-resident-value.css | alpha | `#ffffff32` | `color-mix(in srgb, var(--p-figure) 19.6%, transparent)` |
| src/styles/st-louis-resident-value.css | primitive | `#f3f7f9` | `var(--p-neutral-97)` |
| src/styles/st-louis-resident-value.css | primitive | `#aec9d8` | `var(--p-blue-79e)` |
| src/styles/st-louis-resident-value.css | primitive | `#d5b578` | `var(--p-gold-75)` |
| src/styles/st-louis-resident-value.css | primitive | `#c7d1d6` | `var(--p-neutral-83d)` |
| src/styles/st-louis-resident-value.css | alpha | `#ffffff25` | `color-mix(in srgb, var(--p-figure) 14.5%, transparent)` |
| src/styles/st-louis-resident-value.css | primitive | `#abc1ce` | `var(--p-blue-76b)` |
| src/styles/st-louis-resident-value.css | primitive | `#a8bdc9` | `var(--p-blue-75)` |
| src/styles/st-louis-resident-value.css | alpha | `#ffffff22` | `color-mix(in srgb, var(--p-figure) 13.3%, transparent)` |
| src/styles/st-louis-resident-value.css | alpha | `#ffffff30` | `color-mix(in srgb, var(--p-figure) 18.8%, transparent)` |
| src/styles/st-louis-resident-value.css | primitive | `#aabfc9` | `var(--p-blue-75)` |
| src/styles/st-louis-resident-value.css | alpha | `#ffffff20` | `color-mix(in srgb, var(--p-figure) 12.5%, transparent)` |
| src/styles/st-louis-resident-value.css | primitive | `#a9c9e4` | `var(--p-blue-80b)` |
| src/styles/st-louis-resident-value.css | alpha | `#ffffff24` | `color-mix(in srgb, var(--p-figure) 14.1%, transparent)` |
| src/styles/st-louis-resident-value.css | primitive | `#aec9d8` | `var(--p-blue-79e)` |
| src/styles/st-louis-resident.css | primitive | `#1b2123` | `var(--p-neutral-12)` |
| src/styles/st-louis-resident.css | primitive | `#e3e8e4` | `var(--p-neutral-92)` |
| src/styles/st-louis-resident.css | primitive | `#c4ceca` | `var(--p-neutral-83)` |
| src/styles/st-louis-resident.css | primitive | `#aebfb9` | `var(--p-neutral-76c)` |
| src/styles/st-louis-resident.css | primitive | `#aebfb9` | `var(--p-neutral-76c)` |
| src/styles/st-louis-resident.css | alpha | `#b5c6ba30` | `color-mix(in srgb, var(--p-green-78) 18.8%, transparent)` |
| src/styles/st-louis-resident.css | primitive | `#abc3bc` | `var(--p-teal-77b)` |
| src/styles/st-louis-resident.css | alpha | `#bed2c309` | `color-mix(in srgb, var(--p-green-82) 3.5%, transparent)` |
| src/styles/st-louis-resident.css | primitive | `#b8c3bd` | `var(--p-neutral-79)` |
| src/styles/st-louis-resident.css | primitive | `#edf1e9` | `var(--p-neutral-95g)` |
| src/styles/st-louis-resident.css | primitive | `#bcc9c2` | `var(--p-neutral-79)` |
| src/styles/st-louis-resident.css | primitive | `#586761` | `var(--p-neutral-42d)` |
| src/styles/st-louis-resident.css | primitive | `#142021` | `var(--p-neutral-11)` |
| src/styles/st-louis-resident.css | primitive | `#f1f3eb` | `var(--p-neutral-95g)` |
| src/styles/st-louis-resident.css | primitive | `#91a39c` | `var(--p-teal-65b)` |
| src/styles/st-louis-resident.css | alpha | `#ffffff07` | `color-mix(in srgb, var(--p-figure) 2.7%, transparent)` |
| src/styles/st-louis-resident.css | primitive | `#e4c18a` | `var(--p-gold-80)` |
| src/styles/st-louis-resident.css | alpha | `#e4c18a0c` | `color-mix(in srgb, var(--p-gold-80) 4.7%, transparent)` |
| src/styles/st-louis-resident.css | primitive | `#aabbb3` | `var(--p-neutral-73)` |
| src/styles/st-louis-resident.css | primitive | `#b5c5bd` | `var(--p-neutral-79)` |
| src/styles/st-louis-resident.css | primitive | `#b4c2bb` | `var(--p-neutral-79)` |
| src/styles/st-louis-resident.css | primitive | `#e4c18a` | `var(--p-gold-80)` |
| src/styles/st-louis-resident.css | primitive | `#b6c5be` | `var(--p-neutral-79)` |
| src/styles/st-louis-resident.css | primitive | `#e1c69f` | `var(--p-gold-81b)` |
| src/styles/st-louis-resident.css | primitive | `#bccac2` | `var(--p-neutral-79)` |
| src/styles/st-louis-workbench.css | primitive | `#e4c18a` | `var(--p-gold-80)` |
| src/styles/st-louis-workbench.css | primitive | `#aab3b2` | `var(--p-neutral-72)` |
| src/styles/st-louis-workbench.css | alpha | `#ffffff17` | `color-mix(in srgb, var(--p-figure) 9%, transparent)` |
| src/styles/st-louis-workbench.css | alpha | `#1b2123f5` | `color-mix(in srgb, var(--p-neutral-12) 96.1%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#f2f2ec` | `var(--p-neutral-95)` |
| src/styles/st-louis-workbench.css | primitive | `#121819` | `var(--p-neutral-08c)` |
| src/styles/st-louis-workbench.css | alpha | `#050a0c38` | `color-mix(in srgb, var(--p-neutral-03) 22%, transparent)` |
| src/styles/st-louis-workbench.css | alpha | `#07101424` | `color-mix(in srgb, var(--p-neutral-04) 14.1%, transparent)` |
| src/styles/st-louis-workbench.css | alpha | `#07101475` | `color-mix(in srgb, var(--p-neutral-04) 45.9%, transparent)` |
| src/styles/st-louis-workbench.css | alpha | `#07101422` | `color-mix(in srgb, var(--p-neutral-04) 13.3%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#dde0d9` | `var(--p-neutral-89c)` |
| src/styles/st-louis-workbench.css | primitive | `#8e9999` | `var(--p-neutral-62c)` |
| src/styles/st-louis-workbench.css | primitive | `#101719` | `var(--p-neutral-08c)` |
| src/styles/st-louis-workbench.css | primitive | `#e3e8e1` | `var(--p-neutral-92)` |
| src/styles/st-louis-workbench.css | alpha | `#ffffff19` | `color-mix(in srgb, var(--p-figure) 9.8%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#8a9494` | `var(--p-neutral-62c)` |
| src/styles/st-louis-workbench.css | primitive | `#a9b2ae` | `var(--p-neutral-72)` |
| src/styles/st-louis-workbench.css | alpha | `#6e78724d` | `color-mix(in srgb, var(--p-neutral-49d) 30.2%, transparent)` |
| src/styles/st-louis-workbench.css | alpha | `#181e20fa` | `color-mix(in srgb, var(--p-neutral-12) 98%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#9faaab` | `var(--p-neutral-69c)` |
| src/styles/st-louis-workbench.css | alpha | `#b58d4720` | `color-mix(in srgb, var(--p-gold-61) 12.5%, transparent)` |
| src/styles/st-louis-workbench.css | alpha | `#edca8620` | `color-mix(in srgb, var(--p-gold-83c) 12.5%, transparent)` |
| src/styles/st-louis-workbench.css | alpha | `#ffffff09` | `color-mix(in srgb, var(--p-figure) 3.5%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#f5eedc` | `var(--p-gold-94)` |
| src/styles/st-louis-workbench.css | primitive | `#dbac64` | `var(--p-gold-73b)` |
| src/styles/st-louis-workbench.css | primitive | `#171c1e` | `var(--p-neutral-10)` |
| src/styles/st-louis-workbench.css | primitive | `#000` | `var(--p-neutral-00)` |
| src/styles/st-louis-workbench.css | alpha | `#e0e4d9bd` | `color-mix(in srgb, var(--p-neutral-90c) 74.1%, transparent)` |
| src/styles/st-louis-workbench.css | alpha | `#cfb68166` | `color-mix(in srgb, var(--p-gold-75b) 40%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#e5c486` | `var(--p-gold-81c)` |
| src/styles/st-louis-workbench.css | alpha | `#e4ae4a88` | `color-mix(in srgb, var(--p-gold-74) 53.3%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#11191b` | `var(--p-neutral-08c)` |
| src/styles/st-louis-workbench.css | primitive | `#ebece4` | `var(--p-neutral-95g)` |
| src/styles/st-louis-workbench.css | primitive | `#dec08e` | `var(--p-gold-79b)` |
| src/styles/st-louis-workbench.css | primitive | `#1b2324` | `var(--p-neutral-12)` |
| src/styles/st-louis-workbench.css | alpha | `#ffffff20` | `color-mix(in srgb, var(--p-figure) 12.5%, transparent)` |
| src/styles/st-louis-workbench.css | alpha | `#ffffff03` | `color-mix(in srgb, var(--p-figure) 1.2%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#e0e4de` | `var(--p-neutral-89c)` |
| src/styles/st-louis-workbench.css | primitive | `#cab383` | `var(--p-gold-74b)` |
| src/styles/st-louis-workbench.css | primitive | `#11191b` | `var(--p-neutral-08c)` |
| src/styles/st-louis-workbench.css | alpha | `#ffffff1a` | `color-mix(in srgb, var(--p-figure) 10.2%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#9eafab` | `var(--p-neutral-70b)` |
| src/styles/st-louis-workbench.css | primitive | `#aeb9b2` | `var(--p-neutral-74b)` |
| src/styles/st-louis-workbench.css | primitive | `#caaa6d` | `var(--p-gold-71c)` |
| src/styles/st-louis-workbench.css | alpha | `#e4c18a09` | `color-mix(in srgb, var(--p-gold-80) 3.5%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#60716f` | `var(--p-neutral-46)` |
| src/styles/st-louis-workbench.css | primitive | `#b6beb0` | `var(--p-green-76)` |
| src/styles/st-louis-workbench.css | primitive | `#536965` | `var(--p-teal-43)` |
| src/styles/st-louis-workbench.css | primitive | `#293d3f` | `var(--p-teal-24)` |
| src/styles/st-louis-workbench.css | primitive | `#a48261` | `var(--p-gold-57)` |
| src/styles/st-louis-workbench.css | primitive | `#dfc79a` | `var(--p-gold-81d)` |
| src/styles/st-louis-workbench.css | primitive | `#897657` | `var(--p-gold-51)` |
| src/styles/st-louis-workbench.css | primitive | `#5a5844` | `var(--p-gold-37)` |
| src/styles/st-louis-workbench.css | primitive | `#5e7e93` | `var(--p-blue-51)` |
| src/styles/st-louis-workbench.css | primitive | `#acc0c2` | `var(--p-neutral-76d)` |
| src/styles/st-louis-workbench.css | primitive | `#667f86` | `var(--p-blue-52)` |
| src/styles/st-louis-workbench.css | primitive | `#344b58` | `var(--p-blue-31)` |
| src/styles/st-louis-workbench.css | primitive | `#666` | `var(--p-neutral-43)` |
| src/styles/st-louis-workbench.css | primitive | `#ccc` | `var(--p-neutral-81)` |
| src/styles/st-louis-workbench.css | primitive | `#757575` | `var(--p-neutral-50)` |
| src/styles/st-louis-workbench.css | primitive | `#3a3a3a` | `var(--p-neutral-24)` |
| src/styles/st-louis-workbench.css | primitive | `#e4c18a` | `var(--p-gold-80)` |
| src/styles/st-louis-workbench.css | primitive | `#61d5a5` | `var(--p-teal-78)` |
| src/styles/st-louis-workbench.css | primitive | `#e98648` | `var(--p-gold-66)` |
| src/styles/st-louis-workbench.css | primitive | `#e4c18a` | `var(--p-gold-80)` |
| src/styles/st-louis-workbench.css | primitive | `#1b2123` | `var(--p-neutral-12)` |
| src/styles/st-louis-workbench.css | primitive | `#aeb5b1` | `var(--p-neutral-72)` |
| src/styles/st-louis-workbench.css | primitive | `#f3f0e5` | `var(--p-neutral-95)` |
| src/styles/st-louis-workbench.css | alpha | `#c5a77419` | `color-mix(in srgb, var(--p-gold-70) 9.8%, transparent)` |
| src/styles/st-louis-workbench.css | alpha | `#ffffff02` | `color-mix(in srgb, var(--p-figure) 0.8%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#cbb485` | `var(--p-gold-74b)` |
| src/styles/st-louis-workbench.css | primitive | `#d8c6a1` | `var(--p-gold-80b)` |
| src/styles/st-louis-workbench.css | primitive | `#b9c1ba` | `var(--p-neutral-77d)` |
| src/styles/st-louis-workbench.css | primitive | `#121a1c` | `var(--p-neutral-08c)` |
| src/styles/st-louis-workbench.css | alpha | `#ffffff1b` | `color-mix(in srgb, var(--p-figure) 10.6%, transparent)` |
| src/styles/st-louis-workbench.css | alpha | `#ffffff05` | `color-mix(in srgb, var(--p-figure) 2%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#9ea9a3` | `var(--p-neutral-68b)` |
| src/styles/st-louis-workbench.css | primitive | `#ddc79f` | `var(--p-gold-81e)` |
| src/styles/st-louis-workbench.css | alpha | `#61d5a526` | `color-mix(in srgb, var(--p-teal-78) 14.9%, transparent)` |
| src/styles/st-louis-workbench.css | alpha | `#61d5a508` | `color-mix(in srgb, var(--p-teal-78) 3.1%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#a7e4c2` | `var(--p-green-86)` |
| src/styles/st-louis-workbench.css | primitive | `#efb49d` | `var(--p-red-78)` |
| src/styles/st-louis-workbench.css | alpha | `#ffffff02` | `color-mix(in srgb, var(--p-figure) 0.8%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#d8c6a1` | `var(--p-gold-80b)` |
| src/styles/st-louis-workbench.css | primitive | `#a2d7bc` | `var(--p-teal-82)` |
| src/styles/st-louis-workbench.css | alpha | `#7cb29140` | `color-mix(in srgb, var(--p-green-68) 25.1%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#d4b781` | `var(--p-gold-75b)` |
| src/styles/st-louis-workbench.css | alpha | `#d4b78145` | `color-mix(in srgb, var(--p-gold-75b) 27.1%, transparent)` |
| src/styles/st-louis-workbench.css | alpha | `#ffffff04` | `color-mix(in srgb, var(--p-figure) 1.6%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#a7b1b0` | `var(--p-neutral-72)` |
| src/styles/st-louis-workbench.css | primitive | `#1b2123` | `var(--p-neutral-12)` |
| src/styles/st-louis-workbench.css | primitive | `#051115` | `var(--p-neutral-04)` |
| src/styles/st-louis-workbench.css | primitive | `#000` | `var(--p-neutral-00)` |
| src/styles/st-louis-workbench.css | primitive | `#1b2123` | `var(--p-neutral-12)` |
| src/styles/st-louis-workbench.css | alpha | `#1b2123fa` | `color-mix(in srgb, var(--p-neutral-12) 98%, transparent)` |
| src/styles/st-louis-workbench.css | alpha | `#e4c18a35` | `color-mix(in srgb, var(--p-gold-80) 20.8%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#b9c1ba` | `var(--p-neutral-77d)` |
| src/styles/st-louis-workbench.css | primitive | `#10181a` | `var(--p-neutral-08c)` |
| src/styles/st-louis-workbench.css | primitive | `#f3f3e9` | `var(--p-neutral-95)` |
| src/styles/st-louis-workbench.css | alpha | `#e4c18a22` | `color-mix(in srgb, var(--p-gold-80) 13.3%, transparent)` |
| src/styles/st-louis-workbench.css | alpha | `#e4c18a0a` | `color-mix(in srgb, var(--p-gold-80) 3.9%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#151e20` | `var(--p-neutral-11)` |
| src/styles/st-louis-workbench.css | primitive | `#f0d6aa` | `var(--p-gold-87)` |
| src/styles/st-louis-workbench.css | primitive | `#e7c596` | `var(--p-gold-81f)` |
| src/styles/st-louis-workbench.css | primitive | `#11191b` | `var(--p-neutral-08c)` |
| src/styles/st-louis-workbench.css | primitive | `#d9dfd7` | `var(--p-neutral-89c)` |
| src/styles/st-louis-workbench.css | primitive | `#dabb86` | `var(--p-gold-77)` |
| src/styles/st-louis-workbench.css | primitive | `#8ee8de` | `var(--p-teal-86)` |
| src/styles/st-louis-workbench.css | alpha | `#8ee8de55` | `color-mix(in srgb, var(--p-teal-86) 33.3%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#11191b` | `var(--p-neutral-08c)` |
| src/styles/st-louis-workbench.css | primitive | `#f0f1e9` | `var(--p-neutral-95g)` |
| src/styles/st-louis-workbench.css | primitive | `#e9d8b9` | `var(--p-gold-87b)` |
| src/styles/st-louis-workbench.css | alpha | `#e4c18a30` | `color-mix(in srgb, var(--p-gold-80) 18.8%, transparent)` |
| src/styles/st-louis-workbench.css | alpha | `#e4c18a08` | `color-mix(in srgb, var(--p-gold-80) 3.1%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#83c7ca` | `var(--p-teal-76b)` |
| src/styles/st-louis-workbench.css | alpha | `#83c7ca0c` | `color-mix(in srgb, var(--p-teal-76b) 4.7%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#aad8d3` | `var(--p-teal-83c)` |
| src/styles/st-louis-workbench.css | alpha | `#ffffff17` | `color-mix(in srgb, var(--p-figure) 9%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#273a3b` | `var(--p-teal-24)` |
| src/styles/st-louis-workbench.css | primitive | `#10191c` | `var(--p-neutral-08c)` |
| src/styles/st-louis-workbench.css | alpha | `#9ed7cd0c` | `color-mix(in srgb, var(--p-teal-82b) 4.7%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#d9be89` | `var(--p-gold-77)` |
| src/styles/st-louis-workbench.css | primitive | `#d6dcd4` | `var(--p-neutral-88)` |
| src/styles/st-louis-workbench.css | alpha | `#ffffff1a` | `color-mix(in srgb, var(--p-figure) 10.2%, transparent)` |
| src/styles/st-louis-workbench.css | primitive | `#a7d3d5` | `var(--p-teal-82c)` |
| src/styles/st-louis-workbench.css | primitive | `#e0c39e` | `var(--p-gold-81b)` |
| src/styles/st-louis.css | primitive | `#f4f3ed` | `var(--p-neutral-95)` |
| src/styles/st-louis.css | primitive | `#222b2f` | `var(--p-neutral-17)` |
| src/styles/st-louis.css | primitive | `#e3bc76` | `var(--p-gold-79)` |
| src/styles/st-louis.css | primitive | `#b9bdba` | `var(--p-neutral-76e)` |
| src/styles/st-louis.css | alpha | `rgba(26, 32, 32, 0.89)` | `color-mix(in srgb, var(--p-neutral-12) 89%, transparent)` |
| src/styles/st-louis.css | alpha | `rgba(238, 240, 224, 0.16)` | `color-mix(in srgb, var(--p-green-94) 16%, transparent)` |
| src/styles/st-louis.css | alpha | `rgba(15, 21, 25, 0.48)` | `color-mix(in srgb, var(--p-neutral-06) 48%, transparent)` |
| src/styles/st-louis.css | alpha | `rgba(12, 20, 23, 0.58)` | `color-mix(in srgb, var(--p-neutral-06) 58%, transparent)` |
| src/styles/st-louis.css | primitive | `#172322` | `var(--p-neutral-13c)` |
| src/styles/st-louis.css | primitive | `#e6e8df` | `var(--p-neutral-92b)` |
| src/styles/st-louis.css | role | `white` | `var(--surface-raised)` |
| src/styles/st-louis.css | alpha | `#0002` | `color-mix(in srgb, var(--p-neutral-00) 13.3%, transparent)` |
| src/styles/st-louis.css | primitive | `#757c71` | `var(--p-neutral-51)` |
| src/styles/st-louis.css | primitive | `#f5f4ee` | `var(--p-neutral-95)` |
| src/styles/st-louis.css | alpha | `#f2e5bd10` | `color-mix(in srgb, var(--p-gold-91) 6.3%, transparent)` |
| src/styles/st-louis.css | primitive | `#afb6af` | `var(--p-neutral-74b)` |
| src/styles/st-louis.css | alpha | `#ffffff15` | `color-mix(in srgb, var(--p-figure) 8.2%, transparent)` |
| src/styles/st-louis.css | primitive | `#000` | `var(--p-neutral-00)` |
| src/styles/st-louis.css | primitive | `#d5dad3` | `var(--p-neutral-88)` |
| src/styles/st-louis.css | alpha | `#e3bc7655` | `color-mix(in srgb, var(--p-gold-79) 33.3%, transparent)` |
| src/styles/st-louis.css | primitive | `#bdc4bb` | `var(--p-neutral-77d)` |
| src/styles/st-louis.css | alpha | `#e4bf781c` | `color-mix(in srgb, var(--p-gold-79) 11%, transparent)` |
| src/styles/st-louis.css | primitive | `#f1d69f` | `var(--p-gold-87c)` |
| src/styles/st-louis.css | alpha | `#ffffff10` | `color-mix(in srgb, var(--p-figure) 6.3%, transparent)` |
| src/styles/st-louis.css | primitive | `#c9cfc6` | `var(--p-neutral-82d)` |
| src/styles/st-louis.css | primitive | `#777e77` | `var(--p-neutral-52b)` |
| src/styles/st-louis.css | primitive | `#e1c08a` | `var(--p-gold-80)` |
| src/styles/st-louis.css | primitive | `#f3d7a1` | `var(--p-gold-87c)` |
| src/styles/st-louis.css | primitive | `#313d3c` | `var(--p-neutral-25)` |
| src/styles/st-louis.css | primitive | `#dec08b` | `var(--p-gold-79b)` |
| src/styles/st-louis.css | primitive | `#d6d9d1` | `var(--p-neutral-86c)` |
| src/styles/st-louis.css | primitive | `#000` | `var(--p-neutral-00)` |
| src/styles/st-louis.css | primitive | `#d4d8cd` | `var(--p-neutral-86c)` |
| src/styles/st-louis.css | primitive | `#2a3332` | `var(--p-neutral-20d)` |
| src/styles/st-louis.css | role | `white` | `var(--surface-raised)` |
| src/styles/st-louis.css | primitive | `#d6a954` | `var(--p-gold-72)` |
| src/styles/st-louis.css | primitive | `#201c12` | `var(--p-neutral-10b)` |
| src/styles/st-louis.css | primitive | `#91aabb` | `var(--p-blue-68b)` |
| src/styles/st-louis.css | primitive | `#14232c` | `var(--p-blue-12b)` |
| src/styles/st-louis.css | primitive | `#d6b67b` | `var(--p-gold-75)` |
| src/styles/st-louis.css | primitive | `#222822` | `var(--p-neutral-15)` |
| src/styles/st-louis.css | primitive | `#f3d7a1` | `var(--p-gold-87c)` |
| src/styles/st-louis.css | alpha | `#c6af8320` | `color-mix(in srgb, var(--p-gold-72b) 12.5%, transparent)` |
| src/styles/st-louis.css | alpha | `#ffffff0c` | `color-mix(in srgb, var(--p-figure) 4.7%, transparent)` |
| src/styles/st-louis.css | alpha | `#e3bc7612` | `color-mix(in srgb, var(--p-gold-79) 7.1%, transparent)` |
| src/styles/st-louis.css | primitive | `#d2d9d5` | `var(--p-neutral-88)` |
| src/styles/st-louis.css | primitive | `#b9c4bf` | `var(--p-neutral-79)` |
| src/styles/st-louis.css | alpha | `#ffffff13` | `color-mix(in srgb, var(--p-figure) 7.5%, transparent)` |
| src/styles/st-louis.css | primitive | `#abb9b0` | `var(--p-neutral-73)` |
| src/styles/st-louis.css | primitive | `#e7ece7` | `var(--p-neutral-92)` |
| src/styles/st-louis.css | alpha | `#ffffff0c` | `color-mix(in srgb, var(--p-figure) 4.7%, transparent)` |
| src/styles/st-louis.css | alpha | `#dcc08024` | `color-mix(in srgb, var(--p-gold-79c) 14.1%, transparent)` |
| src/styles/st-louis.css | alpha | `#ffffff0a` | `color-mix(in srgb, var(--p-figure) 3.9%, transparent)` |
| src/styles/st-louis.css | primitive | `#eeeae0` | `var(--p-neutral-93)` |
| src/styles/st-louis.css | alpha | `#ffffff1d` | `color-mix(in srgb, var(--p-figure) 11.4%, transparent)` |
| src/styles/st-louis.css | primitive | `#27332e` | `var(--p-neutral-20e)` |
| src/styles/st-louis.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/st-louis.css | alpha | `#d7c08f13` | `color-mix(in srgb, var(--p-gold-79d) 7.5%, transparent)` |
| src/styles/st-louis.css | alpha | `#d7c08f20` | `color-mix(in srgb, var(--p-gold-79d) 12.5%, transparent)` |
| src/styles/st-louis.css | primitive | `#d3c39e` | `var(--p-gold-80b)` |
| src/styles/st-louis.css | alpha | `#d7c08f29` | `color-mix(in srgb, var(--p-gold-79d) 16.1%, transparent)` |
| src/styles/st-louis.css | primitive | `#aab8af` | `var(--p-neutral-73)` |
| src/styles/st-louis.css | primitive | `#e3bc76` | `var(--p-gold-79)` |
| src/styles/st-louis.css | primitive | `#a5bece` | `var(--p-blue-76c)` |
| src/styles/st-louis.css | alpha | `#1c282bea` | `color-mix(in srgb, var(--p-neutral-14) 91.8%, transparent)` |
| src/styles/st-louis.css | primitive | `#485952` | `var(--p-teal-36)` |
| src/styles/st-louis.css | primitive | `#182326` | `var(--p-neutral-14)` |
| src/styles/st-louis.css | alpha | `#e0bf7730` | `color-mix(in srgb, var(--p-gold-79e) 18.8%, transparent)` |
| src/styles/st-louis.css | primitive | `#e0bf77` | `var(--p-gold-79e)` |
| src/styles/st-louis.css | primitive | `#222` | `var(--p-neutral-13)` |
| src/styles/st-louis.css | primitive | `#202b2a` | `var(--p-neutral-17b)` |
| src/styles/st-louis.css | primitive | `#e9eee5` | `var(--p-neutral-95g)` |
| src/styles/st-louis.css | alpha | `#0008` | `color-mix(in srgb, var(--p-neutral-00) 53.3%, transparent)` |
| src/styles/st-louis.css | alpha | `#06131399` | `color-mix(in srgb, var(--p-neutral-05b) 60%, transparent)` |
| src/styles/st-louis.css | primitive | `#bfc9be` | `var(--p-neutral-80b)` |
| src/styles/st-louis.css | primitive | `#e3bc76` | `var(--p-gold-79)` |
| src/styles/st-louis.css | primitive | `#172525` | `var(--p-neutral-13c)` |
| src/styles/st-louis.css | primitive | `#111b1d` | `var(--p-neutral-09d)` |
| src/styles/st-louis.css | role | `white` | `var(--surface-raised)` |
| src/styles/st-louis.css | alpha | `#101d1c88` | `color-mix(in srgb, var(--p-neutral-10c) 53.3%, transparent)` |
| src/styles/st-louis.css | alpha | `#8eb5a33b` | `color-mix(in srgb, var(--p-teal-70) 23.1%, transparent)` |
| src/styles/st-louis.css | primitive | `#142121` | `var(--p-neutral-11)` |
| src/styles/st-louis.css | primitive | `#f5f4ed` | `var(--p-neutral-95)` |
| src/styles/st-louis.css | primitive | `#9fddbf` | `var(--p-teal-83d)` |
| src/styles/st-louis.css | alpha | `#98ccaa15` | `color-mix(in srgb, var(--p-green-78b) 8.2%, transparent)` |
| src/styles/st-louis.css | primitive | `#b4e1c8` | `var(--p-green-86b)` |
| src/styles/st-louis.css | primitive | `#ffb5a5` | `var(--p-red-81)` |
| src/styles/st-louis.css | primitive | `#b4e1c8` | `var(--p-green-86b)` |
| src/styles/st-louis.css | primitive | `#ffb5a5` | `var(--p-red-81)` |
| src/styles/st-louis.css | alpha | `#0c17244d` | `color-mix(in srgb, var(--p-blue-07b) 30.2%, transparent)` |
| src/styles/st-louis.css | alpha | `#0c172433` | `color-mix(in srgb, var(--p-blue-07b) 20%, transparent)` |
| src/styles/st-louis.css | alpha | `#172126bb` | `color-mix(in srgb, var(--p-neutral-13b) 73.3%, transparent)` |
| src/styles/st-louis.css | primitive | `#f4f3ed` | `var(--p-neutral-95)` |
| src/styles/st-louis.css | primitive | `#b4e1c8` | `var(--p-green-86b)` |
| src/styles/teaching-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/teaching-studio.css | primitive | `#fafafa` | `var(--p-neutral-98)` |
| src/styles/teaching-studio.css | role | `#f2f2f2` | `var(--surface)` |
| src/styles/teaching-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/teaching-studio.css | primitive | `#555` | `var(--p-neutral-36)` |
| src/styles/teaching-studio.css | primitive | `#555` | `var(--p-neutral-36)` |
| src/styles/teaching-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/teaching-studio.css | primitive | `#fafafa` | `var(--p-neutral-98)` |
| src/styles/teaching-studio.css | primitive | `#666` | `var(--p-neutral-43)` |
| src/styles/teaching-studio.css | primitive | `#fafafa` | `var(--p-neutral-98)` |
| src/styles/teaching-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/teaching-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/teaching-studio.css | primitive | `#aaa` | `var(--p-neutral-70)` |
| src/styles/teaching-studio.css | primitive | `#aaa` | `var(--p-neutral-70)` |
| src/styles/teaching-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/teaching-studio.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/teaching-studio.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/teaching-studio.css | primitive | `#efefef` | `var(--p-neutral-93d)` |
| src/styles/teaching-studio.css | primitive | `#aaa` | `var(--p-neutral-70)` |
| src/styles/teaching-studio.css | primitive | `#fafafa` | `var(--p-neutral-98)` |
| src/styles/teaching-studio.css | primitive | `#d4d4d4` | `var(--p-neutral-85)` |
| src/styles/teaching-studio.css | primitive | `#bbb` | `var(--p-neutral-76b)` |
| src/styles/teaching-studio.css | primitive | `#bbb` | `var(--p-neutral-76b)` |
| src/styles/teaching-studio.css | primitive | `#bbb` | `var(--p-neutral-76b)` |
| src/styles/visitor-experience.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/visitor-experience.css | primitive | `#626262` | `var(--p-neutral-41)` |
| src/styles/visitor-experience.css | primitive | `#bcbcbc` | `var(--p-neutral-76b)` |
| src/styles/visitor-experience.css | primitive | `#fafafa` | `var(--p-neutral-98)` |
| src/styles/visitor-experience.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/visitor-experience.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/visitor-experience.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/visitor-experience.css | primitive | `#777` | `var(--p-neutral-50)` |
| src/styles/visitor-experience.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/visitor-experience.css | role | `white` | `var(--surface-raised)` |
| src/styles/visitor-experience.css | primitive | `#666` | `var(--p-neutral-43)` |
| src/styles/visitor-experience.css | primitive | `#ccc` | `var(--p-neutral-81)` |
| src/styles/visitor-experience.css | primitive | `#ccc` | `var(--p-neutral-81)` |
| src/styles/visitor-experience.css | primitive | `#aaa` | `var(--p-neutral-70)` |
| src/styles/visitor-experience.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/visitor-experience.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/visitor-experience.css | primitive | `#555` | `var(--p-neutral-36)` |
| src/styles/visitor-experience.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/visitor-experience.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/visitor-experience.css | primitive | `#666` | `var(--p-neutral-43)` |
| src/styles/visitor-experience.css | primitive | `#ccc` | `var(--p-neutral-81)` |
| src/styles/visitor-experience.css | primitive | `#777` | `var(--p-neutral-50)` |
| src/styles/visitor-experience.css | primitive | `#efefef` | `var(--p-neutral-93d)` |
| src/styles/visitor-experience.css | primitive | `#555` | `var(--p-neutral-36)` |
| src/styles/visitor-experience.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/visitor-experience.css | primitive | `#ccc` | `var(--p-neutral-81)` |
| src/styles/visitor-experience.css | primitive | `#666` | `var(--p-neutral-43)` |
| src/styles/visitor-experience.css | primitive | `#ccc` | `var(--p-neutral-81)` |
| src/styles/visitor-experience.css | primitive | `#666` | `var(--p-neutral-43)` |
| src/styles/visitor-experience.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/visitor-experience.css | primitive | `#fafafa` | `var(--p-neutral-98)` |
| src/styles/visitor-experience.css | role | `#f2f2f2` | `var(--surface)` |
| src/styles/visitor-experience.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/visitor-experience.css | primitive | `#555` | `var(--p-neutral-36)` |
| src/styles/visitor-experience.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/visitor-experience.css | primitive | `#fafafa` | `var(--p-neutral-98)` |
| src/styles/visitor-experience.css | primitive | `#666` | `var(--p-neutral-43)` |
| src/styles/visitor-experience.css | primitive | `#fafafa` | `var(--p-neutral-98)` |
| src/styles/visitor-experience.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/visitor-experience.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/visitor-experience.css | primitive | `#fafafa` | `var(--p-neutral-98)` |
| src/styles/visitor-experience.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/visitor-experience.css | primitive | `#bbb` | `var(--p-neutral-76b)` |
| src/styles/visitor-experience.css | primitive | `#aaa` | `var(--p-neutral-70)` |
| src/styles/visitor-experience.css | primitive | `#fafafa` | `var(--p-neutral-98)` |
| src/styles/visitor-experience.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/visitor-experience.css | role | `#fff` | `var(--surface-raised)` |
| src/styles/visitor-experience.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/visitor-experience.css | primitive | `#555` | `var(--p-neutral-36)` |
| src/styles/visitor-experience.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/visitor-experience.css | primitive | `#171717` | `var(--p-neutral-08b)` |
| src/styles/visitor-experience.css | primitive | `#aaa` | `var(--p-neutral-70)` |