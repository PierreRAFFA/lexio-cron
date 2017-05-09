# Wordz Cron

Cron used by WordZ repository (private) which is a project developed in Unity5 (c#)

##Technical Overview
Crontab
NodeJS  
MongoDB  
Docker

##Docker commands

###Build and push
docker build -t pierreraffa/wordz-cron:latest .  
docker push pierreraffa/wordz-cron:latest  
docker pull pierreraffa/wordz-cron:latest  
  
###Create containers
docker run --name wordz-cron --link wordz-api-mongo:mongo -d pierreraffa/wordz-cron:latest  
  
###Connect to the containers:  
docker exec -it wordz-cron /bin/bash  

###Connect to the logs  
docker logs wordz-cron -f  