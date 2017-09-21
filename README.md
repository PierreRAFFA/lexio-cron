# Lexio Cron

Cron used by WordZ repository (private) which is a project developed in Unity5 (c#)

## Technical Overview
- Crontab  
- NodeJS  
- MongoDB  
- Docker

## Docker commands

#### Build and push
```sh
docker build -t pierreraffa/lexio-cron:latest .  
docker push pierreraffa/lexio-cron:latest  
docker pull pierreraffa/lexio-cron:latest  
```  
#### Create containers
```sh
docker run --name lexio-cron --link lexio-api-mongo:mongo -d pierreraffa/lexio-cron:latest  
```  
#### Connect to the containers:  
```sh
docker exec -it lexio-cron /bin/bash  
```
#### Connect to the logs  
```sh
docker logs lexio-cron -f  
```