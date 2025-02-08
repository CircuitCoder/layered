#!/bin/bash

for FILE in $(find ./dist/render -type f | grep -vE '(\.gz|\.br)$'); do
  echo $FILE
  brotli -fZ $FILE
  gzip -fk9 $FILE
done
