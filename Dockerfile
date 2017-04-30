FROM node:boron

#to prevent the tail issue
VOLUME /var/log/

#RUN apt-get -y install rsyslog
RUN apt-get update
RUN apt-get install -y apt-utils cron

#Copy files
ADD app /app
COPY package.json .
RUN chmod -R 0644 /app/jobs

ADD start-cron.sh /usr/bin/start-cron.sh
RUN chmod +x /usr/bin/start-cron.sh

#Register Crontab
RUN crontab /app/crontab #/etc/cron.d/crontab

#Install dependencies
WORKDIR /app
RUN npm install

#Launch
RUN touch /var/log/cron.log
CMD /usr/bin/start-cron.sh