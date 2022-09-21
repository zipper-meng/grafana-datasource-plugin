# 上手开发

主要参考这片文档：

[Build a data source plugin](https://grafana.com/tutorials/build-a-data-source-plugin/)

## 创建plugin

该步骤已完成，plugin目录为cnosdb。

```bash
Your plugin details
---
Name:  cnosdb
ID:  cnosdb-cnosdb
Description:  A grafana data source plugin for CnosDB.
Keywords:  [ 'cnosdb', 'tsdb', 'timeseries' ]
Author:  false
Organisation:  cnosdb
Website:  www.cnosdb.com
```

## 安装plugin

1. 确认grafana配置文件位置（/etc/grafana/grafana.ini）

1. 确认配置文件中\[paths\] plugins项，关于grafana配置文件的具体说明，请自行查看官方文档

    ```ini
    [paths]
    # Directory where grafana will automatically scan and look for plugins
    ;plugins = /var/lib/grafana/plugins
    ```
1. 修改配置项

    ```ini
    allow_loading_unsigned_plugins = cnosdb-cnosdb
    ```

1. 将本项目中的cnosdb目录复制到plugins目录下：

    ```bash
    # 如果plugins目录不存在就创建它
    sudo mkdir -p /var/lib/grafana/plugins
    sudo cp -r cnosdb /var/lib/grafana/plugins
    # 修改目录所有者，避免出现因文件权限问题，而导致插件无法加载
    sudo chown -R grafana:grafana /var/lib/grafana/plugins
    ```

1. 重启grafana，插件如果没有加载成功，请打开grafana.log(/var/log/grafana/grafana.log)查看具体原因
    