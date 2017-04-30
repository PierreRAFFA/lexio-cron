FROM node:boron

#to prevent the tail issue
VOLUME /var/log/

#Define Workspace
WORKDIR /var/www/wordz-cron/

#RUN apt-get -y install rsyslog
RUN apt-get update
RUN apt-get install -y apt-utils cron

# Bundle app source
RUN mkdir -p /var/www/wordz-cron
COPY . /var/www/wordz-cron
RUN chmod -R 0644 /var/www/wordz-cron/app/jobs

ADD start-cron.sh /usr/bin/start-cron.sh
RUN chmod +x /usr/bin/start-cron.sh

#Register Crontab
RUN crontab /var/www/wordz-cron/app/crontab #/etc/cron.d/crontab

#Install dependencies
RUN npm install

#Launch
RUN touch /var/log/cron.log
CMD /usr/bin/start-cron.sh