# 开发准备

## nodejs与npm

1. 可选择nodejs官网二进制安装最新的lts版本
2. 或选择用操作系统的软件仓库先安装一个版本，再用n命令安装lts版本

```sh
# 安装nodejs最新lts版本
sudo apt install nodejs npm
sudo npm install -g n
sudo n lts
# 查看当前版本
node -v
# 更新npm
sudo npm install -g npm
# 安装yarn
sudo npm install -g yarn
```

## grafana插件开发套件

```sh
sudo npm i @grafana/toolkit
```

## grafana

阅读grafana的[官方文档](https://grafana.com/docs/grafana/latest/setup-grafana/installation/)即可。
