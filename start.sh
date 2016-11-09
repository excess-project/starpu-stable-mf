#!/bin/bash

WORKFLOW=$1
TASK=$2
ID=$3

BASE_DIR=`pwd`
SERVER_DIR=${BASE_DIR}/server 
CLIENT_DIR=${BASE_DIR}/client 

# ############################################################################ #
# START SERVER                                                                 #
# ############################################################################ #
cd ${SERVER_DIR}
./start.sh
sleep 10

# ############################################################################ #
# START CLIENT                                                                 #
# ############################################################################ #
cd ${CLIENT_DIR}
if [ ! -d "${CLIENT_DIR}/dist" ]; then
  make clean all
  make install
fi
cd ${CLIENT_DIR}/dist

./start.sh -w ${WORKFLOW} -t ${TASK} -e ${ID}

export MF_USER=${WORKFLOW}
export MF_TASKID=${TASK}
export MF_EXPID=${ID}