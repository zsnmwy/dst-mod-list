#!/bin/bash
set -Eeuo pipefail
rm -rf ./public/top-mod-item.txt

for i in {1..5}; do
  curl https://steamcommunity.com/workshop/browse/\?appid\=322330\&requiredtags%5B0%5D\=all_clients_require_mod\&actualsort\=trend\&p\="${i}"\&browsesort\=trend\&days\=-1 | grep -o 'sharedfile_.*' | cut -d '"' -f1 | cut -d '_' -f2 | uniq  >> ./public/top-mod-item.txt
done
