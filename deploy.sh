#!/bin/bash

TARGET_DIR="/var/www/ben-chaplin.com"

sudo rsync -av --exclude='deploy.sh' --exclude='.git' ./ $TARGET_DIR
sudo chown -R www-data:www-data $TARGET_DIR
sudo chmod -R 755 $TARGET_DIR

echo "Deployment completed!"
