# EXCESS ATOM Monitoring Server

> ATOM enables users to monitor applications at run-time with ease. In contrast to existing frameworks, our solution profiles applications with high resolution, focuses on energy measurements, and supports a heterogeneous infrastructure.


## Motivation
Reducing the energy consumption is a leading design constraint of current and future HPC systems. Aside from investing into energy-efficient hardware, optimizing applications is key to substantially reduce the energy consumption of HPC cluster. Software developers, however, are usually in the dark when it gets to energy consumption of their applications; HPC clusters rarely provide capabilities to monitor energy consumption on a fine granular level. Predicting the energy consumption of specific applications is even more difficult when the allocated hardware resources vary at each execution. In order to lower the hurdle of energy-aware development, we present ATOM---a light-weight neAr-real Time mOnitoring fraMework.


## Prerequisites

The monitoring server provides the RESTful API to the [monitoring agent][agent]. The server is implemented using Node.js, and connects to Elasticsearch to store and access metric data. Before you start installing the required components, please note that the installation and setup steps mentioned below assume that you are running a current Linux as operating system. The installation was tested with Ubuntu 14.04 LTS as well as with Scientific Linux 6 (Carbon).

Before you can proceed, please clone the repository:

```bash
git clone git://github.com/excess-project/monitoring-server.git
```


### Dependencies

This project requires the following dependencies to be installed:

| Component         | Homepage                                           | Version   |
|------------------ |--------------------------------------------------  |---------  |
| Elasticsearch     | https://www.elastic.co/products/elasticsearch      | >= 1.4.4  |
| Node.js           | https://apr.apache.org/                            | >= 0.9    |
| npm               | https://www.npmjs.com/                             | => 1.3.6  |


#### Installation of Elasticsearch

Please execute the following commands to install version 1.4.4 of `Elasticsearch`. Alternatively, you can use your operating system's software installer to install a current version of `Elasticsearch`.

```bash
cd /tmp
wget https://download.elasticsearch.org/elasticsearch/elasticsearch/elasticsearch-1.4.4.tar.gz
tar -xf elasticsearch-1.4.4.tar.gz
sudo mv elasticsearch-1.4.4 /usr/local/elasticsearch
```

You should then be able to start `Elasticsearch` on port 9200 by executing

```bash
sudo service elasticsearch start
```

with root permissions.


#### Installation of Node.js

Please install a current version of Node.js (>= 0.9) as follows:

```bash
wget http://nodejs.org/dist/v0.12.0/node-v0.12.0-linux-x64.tar.gz
tar -xf node-v0.12.0-linux-x64.tar.gz
sudo mv node-v0.12.0-linux-x64 /usr/local/nodejs
```


#### Installation of npm

When using Ubuntu, for example, please install npm as follows:

```bash
sudo apt-get install npm
```


Again, please feel free to use your operating system's software installer, instead.


## Installation

This section assumes that you've successfully installed all required dependencies as described in the previous paragraphs. When being in the project's directory, execute the following command:

```bash
npm install
```


## Start the server

First, verify once more, that a Elasticsearch database is running

```bash
curl localhost:9200
```

Next, you can start the monitoring server by executing

```bash
npm start
```

from within the project's directory. This command will start the server on
port 3000. Please browse to http://localhost:3030 to check if the startup
was successful.


## RESTful Queries

It follows a list of some RESTful queries to demonstrate its usage:

```bash
# WORKFLOWS
GET /v1/dreamcloud/mf/workflows
GET /v1/dreamcloud/mf/workflows?details
GET /v1/dreamcloud/mf/workflows/power_stream
GET /v1/dreamcloud/mf/workflows/ms2

# EXPERIMENTS
GET /v1/mf/experiments
GET /v1/mf/experiments?details
GET /v1/mf/experiments?workflows=ms2
GET /v1/mf/experiments?workflows=ms2&details
GET /v1/mf/experiments/AU3DzYggYHjgymAd2iPp?workflow=ms2
GET /v1/mf/experiments/AU3DzYggYHjgymAd2iPp?workflow=ms2&extends=tak

# PROFILES
GET /v1/dreamcloud/mf/profiles/ms2/
GET /v1/dreamcloud/mf/profiles/ms2/task_1
GET /v1/dreamcloud/mf/profiles/ms2/task_1/AU3DzggYHjgymAdip

# RUNTIME
GET /v1/dreamcloud/mf/runtime/ms2/task_1/AU3DzggYHjgymAdip
GET /v1/dreamcloud/mf/runtime/ms2/AU3DzYggYHjgymAd2iPp
```

# Monitoring

Please refer to the [installation and monitoring guide][agent] of the monitoring agent in order to fill the database with data that then can be visualized and exported as JSON or CSV.


## Known Issues

### Error message `Unable to revive connection`

Please set the attribute `keepAlive` to `false` when registering the Elasticsearch client in `app.js`:

```javascript
var client = new elasticsearch.Client({
  host: 'localhost:9200',
  log: 'error',
  keepAlive: false
});
```


## Acknowledgment

This project is realized through [EXCESS][excess]. EXCESS is funded by the EU 7th
Framework Programme (FP7/2013-2016) under grant agreement number 611183. We are
also collaborating with the European project [DreamCloud][dreamcloud].


## Contributing
Find a bug? Have a feature request?
Please [create](https://github.com/excess-project/monitoring-server/website/issues) an issue.


## Main Contributors

**Dennis Hoppe, HLRS**
+ [github/hopped](https://github.com/hopped)

**Fangli Pi, HLRS**
+ [github/hpcfapix](https://github.com/hpcfapix)

**Dmitry Khabi, HLRS**

**Yosandra Sandoval, HLRS**

**Anthony Sulisto, HLRS**


## Release History

| Date        | Version | Comment          |
| ----------- | ------- | ---------------- |
| 2016-06-22  | 16.6    | Bugfixes and new features |
| 2016-02-26  | 16.2    | 2nd release (removed backend interface) |
| 2015-12-18  | 1.0     | Public release.  |


## License
Copyright (C) 2014-2016 University of Stuttgart

[Apache License v2](LICENSE).


[agent]: https://github.com/excess-project/monitoring-agent
[excess]: http://www.excess-project.eu
[dreamcloud]: http://www.dreamcloud-project.eu
