#!/bin/bash
set -e

echo "Starting Production Setup..."

# 1. Nginx Configuration
echo "Configuring Nginx..."
sudo cp nginx/probodyline.conf /etc/nginx/sites-available/api.probodyline.co.in
# Remove default if it exists and conflicts, or just link our new one
if [ -L /etc/nginx/sites-enabled/default ]; then
    sudo unlink /etc/nginx/sites-enabled/default
fi
if [ ! -L /etc/nginx/sites-enabled/api.probodyline.co.in ]; then
    sudo ln -s /etc/nginx/sites-available/api.probodyline.co.in /etc/nginx/sites-enabled/
fi
sudo nginx -t
sudo systemctl reload nginx
echo "Nginx configured."

# 2. PM2 Configuration
echo "Configuring PM2..."
# Ensure PM2 is installed globally
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi
# Start app if not running (idempotent check is hard, so just start/restart)
pm2 start dist/main.js --name "probodyline-backend" --env production --update-env || pm2 restart "probodyline-backend" --update-env
pm2 save
# Generate startup script (needs user interaction mostly, but we can try)
pm2 startup | tail -n 1 | bash || echo "Manual PM2 startup command execution might be needed."
echo "PM2 configured."

# 3. Security (UFW)
echo "Configuring UFW..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Enable if not already enabled
# sudo ufw --force enable 
echo "UFW rules updated. (Run 'sudo ufw enable' manually if needed to avoid lockout)"

# 4. Database Backups
echo "Setting up Backups..."
chmod +x scripts/backup_db.sh
# Add to crontab if not exists
(crontab -l 2>/dev/null; echo "0 3 * * * /home/ubuntu/pro-bodyline-backend/scripts/backup_db.sh >> /home/ubuntu/backup.log 2>&1") | sort -u | crontab -
echo "Backup cron job added."

# 5. SSL Auto-renewal
echo "Checking SSL Renewal..."
if systemctl list-timers | grep -q certbot; then
    echo "Certbot renewal timer is active."
else
    echo "Warning: Certbot renewal timer not found. Ensure certbot is installed and configured."
fi

echo "Setup Complete!"
