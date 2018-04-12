FROM node:carbon

ARG nodeEnv
ARG mongoApiPassword

#to prevent the tail issue
VOLUME /var/log/

#Define Workspace
WORKDIR /var/app

#RUN apt-get -y install rsyslog
RUN apt-get update
RUN apt-get install -y apt-utils cron

# Bundle app source
RUN mkdir -p /var/app
COPY . /var/app
RUN chmod -R 0644 /var/app/app/jobs

ADD start-cron.sh /usr/bin/start-cron.sh
RUN chmod +x /usr/bin/start-cron.sh

#Register Crontab
RUN crontab /var/app/app/crontab #/etc/cron.d/crontab

#Install dependencies
RUN npm install --quiet

#Launch
RUN touch /var/log/cron.log
CMD /usr/bin/start-cron.sh