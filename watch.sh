#!/bin/bash

set -e

cd gen
cargo run -- -p ../content -t ../fonts/SourceHanSerifSC-VF.otf -o ../web/src/assets/data.json --wght 900 --feed ../web/public/feed.xml --feed-cfg ./feed-cfg.json --subset-font ../web/src/assets/subset.woff2 --watch
