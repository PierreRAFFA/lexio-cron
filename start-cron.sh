#!/bin/sh
# start-cron.sh

cron
touch /var/log/cron.log
tail -F /var/log/cron.log

#rsyslogd
#cron
#touch /var/log/cron.log
#tail -F /var/log/syslog /var/log/cron.log