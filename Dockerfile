FROM node:boron

VOLUME /var/log/

#RUN apt-get -y install rsyslog
RUN apt-get update
RUN apt-get install -y apt-utils cron


ADD jobs /app/jobs
RUN chmod -R 0644 /app/jobs

ADD crontab /app/crontab
RUN crontab /app/crontab #/etc/cron.d/crontab

ADD start-cron.sh /usr/bin/start-cron.sh
RUN chmod +x /usr/bin/start-cron.sh

RUN touch /var/log/cron.log

WORKDIR /app
COPY package.json .
RUN npm install

CMD /usr/bin/start-cron.sh