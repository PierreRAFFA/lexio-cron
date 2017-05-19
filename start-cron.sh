#!/bin/sh
# start-cron.sh

printenv | sed 's/^\([a-zA-Z0-9_]*\)=\(.*\)$/export \1="\2"/g' > /root/env.sh
chmod +x /root/env.sh
cat /root/env.sh

cron
touch /var/log/cron.log
tail -F /var/log/cron.log

#rsyslogd
#cron
#touch /var/log/cron.log
#tail -F /var/log/syslog /var/log/cron.log