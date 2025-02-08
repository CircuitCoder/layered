#!/bin/bash

for FILE in $(find ./dist/render -type f | grep -vE '(\.gz|\.br)$'); do
  echo $FILE
  brotli -fZ $FILE
  gzip -k9 $FILE
done
