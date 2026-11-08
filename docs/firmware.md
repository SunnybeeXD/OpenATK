# ATK firmware directory

Official firmware files served by ATK's hub API (`https://api-hub-cloud.atk.pro/firmware/{vid}/{pid}/{mark}`), collected from hub 3.2.28. Regenerate with `python3 tools/fwdir.py <hub version>`. 238 files.

These are the vendor's files, unmodified and encrypted. Flash only the one for your exact VID:PID.

Older files also exist under `https://cdn.atk.pro/device/download/` (e.g. `mouse/f1v2/ATK-F1-ULTIMATE-IR-3950Ultra-V3.00.bin`), but that tree has no index and the hub never links it, so it is not listed here.

| Device | VID:PID | Mark | Version | File | Notes |
|---|---|---|---|---|---|
| ATK 8K Nano Dongle | `373b:1178` | dongle | 1.05 | [download](https://bpcdn.atkgear.com/hub-cloud/file/6d37c5a793b597dd5ed7aeb981f3dd7c.bin) | 修复已知问题 |
| ATK A9 3.0 NK | `373b:1305` | a9 | 1.0.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/4e09f88d09da1732068cfc5bc075131e.bin) | Initial Firmware |
| ATK A9 3.0 NK | `373b:134e` | a9 | 1.0.21 | [download](https://bpcdn.atkgear.com/hub-cloud/file/b7e03161109fbc6930badf37ad80b1d4.bin) | Initial Firmware |
| ATK A9 Air | `373b:120a` | a9 | 3.03 | [download](https://bpcdn.atkgear.com/hub-cloud/file/faee293f0867e6547bc4eec74ca710ae.bin) | 1、更新宏录制按键不释放问题 |
| ATK A9 Air | `373b:120a` | a9 | 3.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/e464d49c59ca0cb1a3d35c83cc2dab8d.bin) | 注意：由于优化了设备底层，对应接收器固件版本需要同步升级到V3.00以上 |
| ATK A9 Air + | `373b:1288` | a9 | 1.0.19 | [download](https://bpcdn.atkgear.com/hub-cloud/file/4f142b19d1f710eb143fb7ac4632e687.bin) | Initial Firmware |
| ATK A9 Air + | `373b:1293` | a9 | 5.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/6bd0c61f52f98a09ce32c2fe7f323b14.bin) | 日常更新 |
| ATK A9 Air + | `373b:1293` | a9 | 5.10 | [download](https://bpcdn.atkgear.com/hub-cloud/file/8b24be4417f4a713a25568e68656b2a1.bin) | 出厂固件 |
| ATK A9 Mini | `373b:125a` | a9 | 5.10 | [download](https://bpcdn.atkgear.com/hub-cloud/file/932b54b8eeba14698cb49850f0e4f3c6.bin) | 出厂固件 |
| ATK A9 Mini + | `373b:128e` | a9 | 5.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/6c7b50126c4ce426408aed5e5f7eba07.bin) | 日常更新 |
| ATK A9 Mini + | `373b:128e` | a9 | 5.10 | [download](https://bpcdn.atkgear.com/hub-cloud/file/348f64449ba9c3f9a89054f04ed96353.bin) | 出厂固件 |
| ATK A9 NB ULTRA | `373b:11f3` | a9 | 2.10 | [download](https://bpcdn.atkgear.com/hub-cloud/file/7ae2fa7339715de3cae78f01e854be1a.bin) | 日常更新 |
| ATK A9 NB ULTRA | `373b:11f3` | a9 | 2.09 | [download](https://bpcdn.atkgear.com/hub-cloud/file/8ba18da1b8e242c1cbe7b74c022d8d64.bin) | 日常更新 |
| ATK A9 NB ULTRA | `373b:11f3` | a9 | 2.08 | [download](https://bpcdn.atkgear.com/hub-cloud/file/ff8d50b7456488e332bc690697578fbc.bin) | 1、日常更新 |
| ATK A9 NB ULTRA | `373b:11f3` | a9 | 2.07 | [download](https://bpcdn.atkgear.com/hub-cloud/file/645623127409787b0a97d939815d1536.bin) | 1、默认固件 |
| ATK A9 NK | `373b:1116` | a9 | 1.25 | [download](https://bpcdn.atkgear.com/hub-cloud/file/3c6e0128e537398048a706b9b43b9c65.bin) | 1、修复部分情况下，重启电脑后需拔插接收器问题 |
| ATK A9 NK | `373b:1116` | a9 | 1.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/ca7f6f600b0d638ca64ce24325a806d8.bin) | 6月第1次 固件更新： 1、解决鼠标休眠唤醒，概率性按键会漏键 2、解决鼠标休眠唤醒，鼠标回报率变低 |
| ATK A9 NK | `373b:1116` | a9 | 1.15 | [download](https://bpcdn.atkgear.com/hub-cloud/file/e0f34399a0668494a43bd4e00f7310c5.bin) | 4月第3次 固件更新： 1、修复已知问题 |
| ATK A9 NK | `373b:1116` | a9 | 1.08 | [download](https://bpcdn.atkgear.com/hub-cloud/file/ed3b938157accf96a4f4b28b04443d53.bin) | 4月第1次 固件更新： 1、出厂固件 |
| ATK A9 NK | `373b:1223` | a9 | 1.0.11 | [download](https://bpcdn.atkgear.com/hub-cloud/file/f02eb9a50400c7c348dc03ebdc33a70c.bin) | 出厂固件 |
| ATK A9 Plus 3.0 NK | `373b:1337` | a9 | 1.0.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/bb07dd1647bb78315db6bf9deeb04555.bin) | Initial Firmware |
| ATK A9 Plus NK | `373b:1115` | a9 | 1.30 | [download](https://bpcdn.atkgear.com/hub-cloud/file/0dc84a90ab04b1ccf7b8188348f2de8c.bin) | 修复已知问题 |
| ATK A9 Plus NK | `373b:1115` | a9 | 1.27 | [download](https://bpcdn.atkgear.com/hub-cloud/file/30d799044167b52517bd6bbed7d26a59.bin) | 修复部分情况下接收器无法识别问题 |
| ATK A9 Plus NK | `373b:1115` | a9 | 1.26 | [download](https://bpcdn.atkgear.com/hub-cloud/file/af9beb116b4acd764e9bba1c460b6ad1.bin) | 1、优化鼠标宏功能 |
| ATK A9 Plus NK | `373b:1115` | a9 | 1.25 | [download](https://bpcdn.atkgear.com/hub-cloud/file/0287c93c4fe91855c8b6e3ef1efa845a.bin) | 1、修复部分情况下，重启电脑后需拔插接收器问题 |
| ATK A9 Plus NK | `373b:1115` | a9 | 1.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/662eaca0ef4f179e538941fac37268ce.bin) | 6月第1次 固件更新： 1、解决鼠标休眠唤醒，概率性按键会漏键 2、解决鼠标休眠唤醒，鼠标回报率变低 |
| ATK A9 Plus NK | `373b:1115` | a9 | 1.15 | [download](https://bpcdn.atkgear.com/hub-cloud/file/3ebc0808407230da36aa483f3f7a96ca.bin) | 4月第3次 固件更新： 1、修复已知问题 |
| ATK A9 Plus NK | `373b:1115` | a9 | 1.08 | [download](https://bpcdn.atkgear.com/hub-cloud/file/f7b7c03709a30df938c0d24ff28b54b9.bin) | 4月第1次 固件更新： 1、出厂固件 |
| ATK A9 Plus NK | `373b:1224` | a9 | 1.0.12 | [download](https://bpcdn.atkgear.com/hub-cloud/file/571e307aca3dd97a9bf94782111fd285.bin) | 出厂固件 |
| ATK A9 Plus NK | `373b:1300` | a9 | 1.0.17 | [download](https://bpcdn.atkgear.com/hub-cloud/file/5dc561261b643d1df403374345311d71.bin) | Initial Firmware |
| ATK A9 Pro | `373b:112d` | a9 | 1.24 | [download](https://bpcdn.atkgear.com/hub-cloud/file/27f49b091753cfdb07347324e46ae8ae.zip) | 1、支持切换指定板载配置 |
| ATK A9 Pro | `373b:112d` | a9 | 1.23 | [download](https://bpcdn.atkgear.com/hub-cloud/file/df6506b0c40c2c9245e6afd9dead23a0.zip) | 1.修复板载切换无效的问题 2.修复8k接收器下新增DPI档位时，修改DPI值无效的问题 |
| ATK A9 Pro Max | `373b:1117` | a9 | 2.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/169a4a3d348ba75aae53bc462708a7ce.bin) | 9月第1次 固件更新： 1、修复已知问题 |
| ATK A9 Pro Max 2.0 NK | `373b:11db` | a9 | 1.0.12 | [download](https://bpcdn.atkgear.com/hub-cloud/file/c74c0a5b2a035d8a7cd12a5ce4e6468c.bin) | 优化充满后偶尔闪黄灯的问题 |
| ATK A9 Pro Max 2.0 NK | `373b:1264` | a9 | 1.0.13 | [download](https://bpcdn.atkgear.com/hub-cloud/file/2c7c36031a77fb745700db69668e2d98.bin) | 修复已知问题 |
| ATK A9 Pro Max 2.0 NK | `373b:1301` | a9 | 1.0.17 | [download](https://bpcdn.atkgear.com/hub-cloud/file/aac290b4b864e1fe7c62dde15a47b6d4.bin) | 初始固件 |
| ATK A9 Pro Max 3.0 NK | `373b:1338` | a9 | 1.0.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/cdc99e6cd3e3fc78ed89304d8e6c125e.bin) | Initial Firmware |
| ATK A9 SE 3.0 NK | `373b:130f` | a9 | 1.0.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/84ec1e5728649b4866615588cb3441f3.bin) | Initial Firmware |
| ATK A9 SE NK | `373b:1135` | a9 | 1.25 | [download](https://bpcdn.atkgear.com/hub-cloud/file/5b4f8267c584f232ed050db0a870d350.bin) | 1、修复部分情况下，重启电脑后需拔插接收器问题 |
| ATK A9 SE NK | `373b:1135` | a9 | 1.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/950cfa14d7522794dfb70beaaad2ef03.bin) | 6月第1次 固件更新： 1、解决鼠标休眠唤醒，概率性按键会漏键 2、解决鼠标休眠唤醒，鼠标回报率变低 |
| ATK A9 SE NK | `373b:1135` | a9 | 1.15 | [download](https://bpcdn.atkgear.com/hub-cloud/file/12dbd46f6792018ced4a2d1076a37739.bin) | 4月第3次 固件更新： 1、修复已知问题 |
| ATK A9 SE NK | `373b:1135` | a9 | 1.08 | [download](https://bpcdn.atkgear.com/hub-cloud/file/0daa6c6b7c9d159f2ea7221c3f38bea6.bin) | 4月第1次 固件更新： 1、出厂固件 |
| ATK A9 SE NK | `373b:1222` | a9 | 1.0.11 | [download](https://bpcdn.atkgear.com/hub-cloud/file/f933237dde6ba414fda9edfe52fd29d5.bin) | Initial Firmware |
| ATK A9 Ultimate | `373b:11b6` | a9 | 3.03 | [download](https://bpcdn.atkgear.com/hub-cloud/file/cc058e6d3e7c4504813294561bf27f4d.bin) | 1、更新宏录制按键不释放问题 |
| ATK A9 Ultimate | `373b:11b6` | a9 | 3.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/1e683015504d233a39875460021f34fe.bin) | 10月第1次3.00固件更新： 1、优化抗干扰能力 注意：由于优化了设备底层，对应接收器固件版本需要同步升级到V3.00以上 |
| ATK A9 Ultimate | `373b:1314` | a9 | 1.1.4 | [download](https://bpcdn.atkgear.com/hub-cloud/file/60cf9cd32c98d8b9af7d8570e2495f1f.bin) | Initial Firmware |
| ATK A9 Ultimate + | `373b:1292` | a9 | 5.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/0adc896090a806bd305093acb3eb15b8.bin) | 日常更新 |
| ATK A9 Ultimate + | `373b:1292` | a9 | 5.10 | [download](https://bpcdn.atkgear.com/hub-cloud/file/2be4805ebad6a255c8f5bcfef5c2e661.bin) | 出厂固件 |
| ATK A9 Ultra | `373b:1119` | a9 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/73e70a4ef1502fb5976f3a261311f91e.bin) | 6月第1次 固件更新： 1、更新绝鲨竞技固件MAX≥20000fps |
| ATK A9 Ultra Max 2.0 | `373b:11dd` | a9 | 3.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/0c145dc7afdbeec03ec3ae0dd1d056b9.bin) | 10月第1次3.00固件更新： 1、优化抗干扰能力 注意：由于优化了设备底层，对应接收器固件版本需要同步升级到V3.00以上 |
| ATK A9 Ultra Max 2.0 Tri-Mode | `373b:11f2` | a9 | 3.02 | [download](https://bpcdn.atkgear.com/hub-cloud/file/3d8e2b268e8cfd82b7de1cff4e7f23c9.bin) | 日常更新 |
| ATK A9 Ultra Max 2.0 Tri-Mode | `373b:1270` | a9 | 3.03 | [download](https://bpcdn.atkgear.com/hub-cloud/file/134daac77aab9adb4c9f610ea2d6328c.bin) | 日常更新 |
| ATK Duckbill Ultra | `373b:11a6` | duckbill | 3.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/4c32d77765d73cff81dfca1f43b166de.bin) | 10月第1次3.00固件更新： 1、优化抗干扰能力 注意：由于优化了设备底层，对应接收器固件版本需要同步升级到V3.00以上 |
| ATK Duckbill Ultra | `373b:11a6` | duckbill | 1.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/d53c0d459ffc85e89b53fa78912bed38.bin) | 9月第1次1.20固件更新： 1、适配新版54H20接收器 |
| ATK F1 EXTREME | `373b:1045` | f1 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/fab7098a70c5ab63f104eecd48f50845.bin) | 6月第1次 固件更新： 1、更新绝鲨竞技固件MAX≥20000fps |
| ATK F1 EXTREME 2.0 | `373b:11e3` | f1 | 3.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/ecfcd845e2df9027b1216eb728df707b.bin) | 10月第1次3.00固件更新： 1、优化抗干扰能力 注意：由于优化了设备底层，对应接收器固件版本需要同步升级到V3.00以上 |
| ATK F1 LEVIATAN | `373b:105b` | f1 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/1194422426b1e68f2779f5b60f413f01.bin) | 6月第1次 固件更新： 1、更新绝鲨竞技固件MAX≥20000fps |
| ATK F1 LEVIATAN 2.0 | `373b:11f0` | f1 | 3.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/9a5ebab214470a281f01ecce0f927cb1.bin) | 10月第1次3.00固件更新： 1、优化抗干扰能力 注意：由于优化了设备底层，对应接收器固件版本需要同步升级到V3.00以上 |
| ATK F1 PRO | `373b:1014` | f1 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/37ba637428aa57a6e98ae37ae9fcc34b.bin) | 6月第1次 固件更新： 1、更新绝鲨竞技固件MAX≥20000fps |
| ATK F1 PRO MAX | `373b:1015` | f1 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/ae4aef4c78ca3d87f999bf2703397eaf.bin) | 6月第1次 固件更新： 1、更新绝鲨竞技固件MAX≥20000fps |
| ATK F1 Ultimate | `373b:102e` | f1 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/2d4b7756bc145fdb4dfc47e536c0cfe4.bin) | 6月第1次 固件更新： 1、更新绝鲨竞技固件MAX≥20000fps |
| ATK F1 Ultimate 2.0 | `373b:11e4` | f1 | 3.03 | [download](https://bpcdn.atkgear.com/hub-cloud/file/13b413bc3f8cafe8cf73e542c5433526.bin) | 1、更新宏录制按键不释放问题 |
| ATK F1 Ultimate 2.0 | `373b:11e4` | f1 | 3.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/0730a5f64ca17bba9070110f82dd49e1.bin) | 10月第1次3.00固件更新： 1、优化抗干扰能力 注意：由于优化了设备底层，对应接收器固件版本需要同步升级到V3.00以上 |
| ATK F1 Ultra Max 2.0 | `373b:11ed` | f1 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/0413c2af279f702963e683c183d1c4ab.bin) | 10月第1次3.01固件更新： 1、优化抗干扰能力 注意：由于优化了设备底层，对应接收器固件版本需要同步升级到V3.00以上 |
| ATK F1 Ultra Max 2.0 | `373b:126e` | f1 | 3.03 | [download](https://bpcdn.atkgear.com/hub-cloud/file/4dbf1408a4c307b8730ed40d2d61f503.bin) | 出厂固件 |
| ATK F1 V3 ULTIMATE + | `373b:12a7` | f1 | 1.21 | [download](https://bpcdn.atkgear.com/hub-cloud/file/8741b2e9bf387b3ea614b1786a2fbcfa.bin) | 初始固件 |
| ATK Ghost EXTREME | `373b:120d` | ghost | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/257f9b110d47923f259d60e7cdb20a4b.bin) | 修复已知问题，优化使用体验 |
| ATK Ghost EXTREME | `373b:120d` | ghost | 3.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/48328738203cdbbf4b80bfec6d73f6e1.bin) | 出厂固件 |
| ATK Ghost EXTREME + | `373b:128a` | ghost | 5.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/f86a876e7559daab6e03a358cf04739f.bin) | Initial Firmware |
| ATK Ghost Ultimate | `373b:120e` | ghost | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/d515775d9d728bd87532f171d32dea77.bin) | 出厂固件 |
| ATK Ghost Ultimate + | `373b:128b` | ghost | 5.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/a09d3ee969242486b73e7617b3e2ca6a.bin) | Initial Firmware |
| ATK Horizon | `373b:120c` | ttgk | 0.9 | [download](https://bpcdn.atkgear.com/hub-cloud/file/536886e273278e8aee2adb19952682ac.bin) | 日常更新 |
| ATK Horizon | `373b:120c` | ttgk | 0.8 | [download](https://bpcdn.atkgear.com/hub-cloud/file/2a3052233013ad473a096a2dc2a2f968.bin) | 1、出厂固件 |
| ATK Mercury Ⅰ | `373b:107c` | device | 1.2.2 | [download](https://bpcdn.atkgear.com/hub-cloud/file/b9f437bb5299483d9346bc2774857458.zip) | 处理耳机驱动程序 |
| ATK N9 V2 PRO | `373b:12d4` | dongle | 0.0.1.8 | [download](https://bpcdn.atkgear.com/hub-cloud/file/b75fb64ae97207bf3f2681add13fbe0f.bin) | 更新内容： 增加Dongle和耳机无连接5分钟时Dongle指示灯熄灭的操作 |
| ATK N9 V2 PRO | `373b:12d4` | dongle | 0.0.1.7 | [download](https://bpcdn.atkgear.com/hub-cloud/file/bbf71d84501b3222aef65da137731dfb.bin) | [English tone] Initial firmware 【英文提示音】 初始固件 |
| ATK N9 V2 Ultimate | `373b:1262` | dongle | 0.0.1.3 | [download](https://bpcdn.atkgear.com/hub-cloud/file/c68ec0840a3db22543627e0677c2fb00.bin) | Update content: Added the operation where the Dongle indicator light goes out after 5 minutes of no connection when usin |
| ATK N9 V2 Ultimate | `373b:1262` | dongle | 0.0.1.2 | [download](https://bpcdn.atkgear.com/hub-cloud/file/2abde9c64da7f34f0d22ed9d0e708db8.bin) | [English tone] Initial firmware 【英文提示音】 初始固件 |
| ATK N9 V2 ULTRA | `373b:12d6` | dongle | 0.0.1.8 | [download](https://bpcdn.atkgear.com/hub-cloud/file/57f07bab45fd3ab2f067d28100db366b.bin) | Update content: Added the operation where the Dongle indicator light goes out after 5 minutes of no connection when usin |
| ATK N9 V2 ULTRA | `373b:12d6` | dongle | 0.0.1.7 | [download](https://bpcdn.atkgear.com/hub-cloud/file/c064cf8594c8563dec456ddba4657714.bin) | 初始固件 |
| ATK P9 | `373b:12ba` | dongle | 0.0.1.3 | [download](https://bpcdn.atkgear.com/hub-cloud/file/7908a295e4b500e8f8d90d87d44259c5.bin) | 初始固件 |
| ATK P9 Pro | `373b:12bb` | dongle | 0.0.3.4 | [download](https://bpcdn.atkgear.com/hub-cloud/file/96dd9237595b3417b159b0b5814c6e29.bin) | 初始固件 |
| ATK PHANTOM ULTIMATE | `373b:1312` | phantom | 1.1.6 | [download](https://bpcdn.atkgear.com/hub-cloud/file/244206a850b9fe2c91234ac8302b74e6.bin) | Signal stability upgrade: Enhance anti-interference ability and optimize signal performance in complex electromagnetic e |
| ATK PHANTOM ULTIMATE | `373b:1312` | phantom | 1.0.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/c1787016de0ce0b6b30248c80283aac7.bin) | Initial Firmware |
| ATK RS6 | `373b:109c` | rs6 | 2.02 | [download](https://bpcdn.atkgear.com/hub-cloud/file/61212ffff681f9a0d1f8b8de06172603.bin) | 修复部分情况下校准异常问题 |
| ATK RS6 | `373b:109c` | rs6 | 2.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/fd487624e2bb8437d10b5272b50957cf.bin) | 1. 新增手柄模拟功能 2. 新增全键无冲/6键无冲自动切换功能 3. 新增FN按键改键功能 4. 快捷键指令支持启动方式 5. CAPS、WIN键指示灯支持自定义颜色 6. 优化指尖涟漪、指尖彩虹灯效，新增全彩、单色切换功能 7.修复已知 |
| ATK RS6 | `373b:109c` | rs6 | 1.80 | [download](https://bpcdn.atkgear.com/hub-cloud/file/98c2f3766b47d01b37a7f32855fc476b.bin) | 1. 新增USB轮询率切换功能 2. 新增轴体校准灯效 3. 新增自动校准功能 4. 新增[星岚轴]轴体支持 3. 优化轴体校准算法 4. 优化指尖彩虹灯效效果 5. 优化板载、灯效切换按键稳定性 6. 修复已知Bug，提高键盘稳定性 |
| ATK RS6 | `373b:109c` | rs6 | 1.72 | [download](https://bpcdn.atkgear.com/hub-cloud/file/71a01545474ea6a508dc1da3eabf7dca.bin) | 9月第1次1.72固件更新： 1. 修复部分情况下按键断触、卡键的问题 2. 修复已知Bug，提高键盘稳定性 |
| ATK RS6 | `373b:109c` | rs6 | 1.70 | [download](https://bpcdn.atkgear.com/hub-cloud/file/d6d180f02cf93db45bc7c1b55ea51c8f.bin) | 9月第1次1.70固件更新： 1. 升级烈风三代Ultra固件 2. 修改切换板载快捷键为长按 FN+Z/X/C/V 3秒 3. 修复部分情况下灯光亮度设置无效的问题 4. 修复已知Bug，提高键盘稳定性 |
| ATK RS6 | `373b:109c` | rs6 | 1.62 | [download](https://bpcdn.atkgear.com/hub-cloud/file/2f9f6a9442ff8ea49711458c2dbc330b.bin) | 8月第1次1.62固件更新： 1.修复部分情况下，混轴后导致校准丢失的问题 2.修复“圣诞”灯效下大写锁定灯光异常的问题 3.添加设备开机/唤醒灯光缓亮效果 4.新增切换板载快捷键（FN+ALT+1/2/3/4） 5.新增唤醒网页驱动快捷键 |
| ATK RS6 | `373b:109c` | rs6 | 1.50 | [download](https://bpcdn.atkgear.com/hub-cloud/file/04c71a7cfbcc19caab83eb05c0f6e72c.bin) | 7月第1次1.50固件更新： 更新内容： 1.添加灯光秀功能【ATK HUB 3.0 Beta 客户端支持】 2.修复已知Bug，提高键盘稳定性 |
| ATK RS6 | `373b:109c` | rs6 | 1.41 | [download](https://bpcdn.atkgear.com/hub-cloud/file/b8d1dc7189aa7e1c124ccd4937ab66a9.bin) | 6月第2次1.41固件更新： 更新内容： 1. 修复部分情况下更换轴体后导致底部死区增大的问题 2. 修复使用组合键时恢复出厂设置时灯光闪烁异常的问题 3. 修复已知Bug，提高设备性能与稳定性 |
| ATK RS6 | `373b:109c` | rs6 | 1.40 | [download](https://bpcdn.atkgear.com/hub-cloud/file/787c8d3acd99e9a7ad097669137c6a5d.bin) | 6月第1次1.40固件更新： 更新内容： 1.新增混轴功能 2.修复其他已知Bug，提高性能与稳定性 |
| ATK RS6 | `373b:109c` | rs6 | 1.30 | [download](https://bpcdn.atkgear.com/hub-cloud/file/4c7d8ae9c7edd4ee9ab53a57d12819dd.bin) | 4月第2次1.30固件更新： 更新内容： 1.升级极限模式下0.001mm最小RT 2.修复其他已知Bug，提高性能与稳定性 |
| ATK RS6 | `373b:109c` | rs6 | 1.22 | [download](https://bpcdn.atkgear.com/hub-cloud/file/10bc3521adfce222fa4f70364ff455ad.bin) | 4月第1次1.22固件更新： 更新内容： 1.新增灯光定时休眠功能 2.修复其他已知Bug，提高性能与稳定性 |
| ATK RS6 | `373b:109c` | rs6 | 1.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/cb3a86cfd9f211f8c9c44a84e9d33c88.bin) | 3月第1次1.20固件更新： 更新内容： 1.增加AI MATCH 动态自适应功能 ，用户可自行开启。 （解决因不同轴体公差造成的极限模式下偶发断触问题，） 2.修复部分情况下灯光亮度降低的问题 3.修复部分情况下底部死区失效的问题 4.修 |
| ATK RS6 | `373b:109c` | rs6 | 1.12 | [download](https://bpcdn.atkgear.com/hub-cloud/file/1508b571746a05e0ecc6340ca1c5010a.bin) | 2月第2次1.12固件更新： 1.添加音乐律动功能 2.修复已知Bug，提高稳定性 注意：为了保证最好的使用体验与键盘性能，更新固件后键盘需要恢复出厂设置后才可使用 |
| ATK RS6 | `373b:109c` | rs6 | 1.10 | [download](https://bpcdn.atkgear.com/hub-cloud/file/f5bfc16b6a7c70b9e39b64d8e593fe9a.bin) | 2月第1次1.10固件更新： 1.优化音乐律动性能 2.解决因异常资源占用导致延迟过高的问题 3.修复已知Bug，提高稳定性 注意：为了保证最好的使用体验与键盘性能，更新固件后键盘需要恢复出厂设置后才可使用 |
| ATK U2 Mini 2.0 | `373b:11f6` | u2 | 3.03 | [download](https://bpcdn.atkgear.com/hub-cloud/file/e5e788103d80033c2f1a54e059bb7c4a.bin) | 1、更新宏录制按键不释放问题 |
| ATK U2 Mini 2.0 | `373b:11f6` | u2 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/181fc6c72cfe0f120be288a76a27e989.bin) | 12月第1次3.01固件更新： 1、优化抗干扰能力 注意：由于优化了设备底层，对应接收器固件版本需要同步升级到V3.00以上 |
| ATK U2 NK | `373b:110e` | u2 | 1.21 | [download](https://bpcdn.atkgear.com/hub-cloud/file/c11d8d817088b29b6a1d91779fe74bdf.bin) | 8月第1次 固件更新： 1、按键功能修改后马上切换配置，有概率按键修改失败 |
| ATK U2 NK | `373b:110e` | u2 | 1.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/68c28e09e2cd81f9b609013e6842fa6b.bin) | 6月第1次 固件更新： 1、解决鼠标休眠唤醒，概率性按键会漏键 2、解决鼠标休眠唤醒，鼠标回报率变低 |
| ATK U2 Plus NK | `373b:110d` | u2 | 1.21 | [download](https://bpcdn.atkgear.com/hub-cloud/file/c1687bea95e3902390813ef96dd9268e.bin) | 8月第1次 固件更新： 1、按键功能修改后马上切换配置，有概率按键修改失败 |
| ATK U2 Plus NK | `373b:110d` | u2 | 1.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/6394ed0a818a860af0dd08dbc5bb58a1.bin) | 6月第1次 固件更新： 1、解决鼠标休眠唤醒，概率性按键会漏键 2、解决鼠标休眠唤醒，鼠标回报率变低 |
| ATK U2 Pro | `373b:10ec` | u2 | 1.23 | [download](https://bpcdn.atkgear.com/hub-cloud/file/ce4da45add7836af9648be50dccddd82.zip) | 1.修复板载切换无效的问题 2.修复8k接收器下新增DPI档位时，修改DPI值无效的问题 |
| ATK U2 Pro | `373b:10ec` | u2 | 1.10 | [download](https://bpcdn.atkgear.com/hub-cloud/file/f16582ccc1c4ab02165946a25e282a28.zip) | 7月第1次1.10固件更新： 更新内容： 1、PRO适配corded、传感器角度旋转 |
| ATK U2 Pro | `373b:10ec` | u2 | 1.09 | [download](https://bpcdn.atkgear.com/hub-cloud/file/68ea3db24c3241377c799ca83d469a63.zip) | 6月第1次1.09固件更新： 更新内容： 1、修复2.4G模式下部分鼠标休眠问题 |
| ATK U2 Pro Max | `373b:1158` | u2 | 1.82 | [download](https://bpcdn.atkgear.com/hub-cloud/file/3766f9fc9b8790472631d03cbd332f9d.bin) | 5月第1次1.82固件更新： 更新内容： 1.更新了绝鲨竞技固件MAX 2.更新了传感器的“旋转”功能 |
| ATK U2 SE NK | `373b:1149` | u2 | 1.21 | [download](https://bpcdn.atkgear.com/hub-cloud/file/09ddecb3f10cda7567459a01ebcb2588.bin) | 8月第1次 固件更新： 1、按键功能修改后马上切换配置，有概率按键修改失败 |
| ATK U2 SE NK | `373b:1149` | u2 | 1.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/8524e4be651226e21611f59c813c3702.bin) | 6月第1次 固件更新： 1、解决鼠标休眠唤醒，概率性按键会漏键 2、解决鼠标休眠唤醒，鼠标回报率变低 |
| ATK U2 Ultimate | `373b:1087` | u2 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/50192411c56b67903fdcac2e03dfd81e.bin) | 5月第1次3.01固件更新： 更新内容： 1.更新了绝鲨竞技固件MAX 2.更新了传感器的“旋转”功能 |
| ATK U2 Ultimate 2.0 | `373b:11f5` | u2 | 3.03 | [download](https://bpcdn.atkgear.com/hub-cloud/file/4cf692b5aae36db37e9e889e93d202dd.bin) | 1、更新宏录制按键不释放问题 |
| ATK U2 Ultimate 2.0 | `373b:11f5` | u2 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/b4c08a88bfe756ca610a0f65c7492c54.bin) | 12月第1次3.01固件更新： 1、优化抗干扰能力 注意：由于优化了设备底层，对应接收器固件版本需要同步升级到V3.00以上 |
| ATK U2 Ultra | `373b:10ac` | u2 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/ab1ddeef1a321677c47732e479d722f8.bin) | 5月第1次3.01固件更新： 更新内容： 1.更新了绝鲨竞技固件MAX 2.更新了传感器的“旋转”功能 |
| ATK x QK Hex80 | `373b:1177` | hex80 | 2.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/9fbf14866c07600c73d6cf901e987174.bin) | 1. 新增手柄模拟功能 2. 新增全键无冲/6键无冲自动切换功能 3. 新增FN按键改键功能 4. 快捷键指令支持启动方式 5. CAPS、WIN键指示灯支持自定义颜色 6. 优化指尖涟漪、指尖彩虹灯效，新增全彩、单色切换功能 7.修复已知 |
| ATK x QK Hex80 | `373b:1177` | hex80 | 1.40 | [download](https://bpcdn.atkgear.com/hub-cloud/file/8b0c7e7b6eaf7710365657aec4c075ad.bin) | 1. 新增USB轮询率切换功能 2. 新增轴体校准灯效 3. 新增自动校准功能 4. 新增[星岚轴]轴体支持 5. 优化轴体校准算法 6. 修复已知Bug，提高键盘稳定性 |
| ATK x QK Hex80 | `373b:1177` | hex80 | 1.32 | [download](https://bpcdn.atkgear.com/hub-cloud/file/39d2abf5966708c154ac2b7ea1c35ac8.bin) | 9月第1次1.32固件更新： 更新内容： 1. 修复部分情况下按键断触、卡键的问题 2. 修复已知Bug，提高键盘稳定性 |
| ATK x QK Hex80 | `373b:1177` | hex80 | 1.31 | [download](https://bpcdn.atkgear.com/hub-cloud/file/280f8af923e6e419027c4debb2581506.bin) | 9月第1次1.31固件更新： 更新内容： 1. 升级烈风三代Ultra固件 2. 修复部分情况下灯光亮度设置无效的问题 3. 修复部分情况下设备重启后异常进入升级模式的问题 4. 修复已知Bug，提高键盘稳定性 |
| ATK x QK Hex80 | `373b:1177` | hex80 | 1.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/e56634396638c597c22843240925822f.bin) | 8月第1次1.20固件更新： 更新内容： 1.修复部分情况下，混轴后导致校准丢失的问题 2.添加设备开机/唤醒灯光缓亮效果 3.修复已知Bug，提高系统稳定性 4.修复了部分型号精度测试异常的问题 |
| ATK x QK Hex80 | `373b:1177` | hex80 | 1.10 | [download](https://bpcdn.atkgear.com/hub-cloud/file/9b91a16841443400d0e5d8b0bf1fd58f.bin) | 7月第1次1.10固件更新： 更新内容： 1.添加灯光秀功能【ATK HUB 3.0 Beta 客户端支持】 2.修复已知Bug，提高键盘稳定性 |
| ATK x QK Hex80 | `373b:1177` | hex80 | 1.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/838a37daca731175890d8e0cc6965055.bin) | 6月第1次1.00固件更新： 1、初始版本固件 |
| ATK X1 | `373b:10d8` | x1 | 1.22 | [download](https://bpcdn.atkgear.com/hub-cloud/file/d53d0b765157a6a9d2c59eb79e49b3d8.zip) | 9月第1次1.22固件更新： 更新内容： 1、新增单独调整X/Y轴DPI功能 2、修复无法切换板载配置问题 |
| ATK X1 | `373b:10d8` | x1 | 1.07 | [download](https://bpcdn.atkgear.com/hub-cloud/file/d5df2674ad9bffe050bde74fbf65c16a.zip) | 7月第1次1.07固件更新： 更新内容： 1、PRO适配corded、传感器角度旋转 |
| ATK X1 Air + | `373b:12a2` | x1 | 5.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/5f4128cd7765bc6b6a43ccde91f3512c.bin) | 日常更新 |
| ATK X1 EXTREME 2.0 | `373b:11e5` | x1 | 3.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/fe8711bfedc4160a8ec639052f0f47db.bin) | 10月第1次3.00固件更新： 1、优化抗干扰能力 注意：由于优化了设备底层，对应接收器固件版本需要同步升级到V3.00以上 |
| ATK X1 EXTREME 2.0 + | `373b:1285` | x1 | 5.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/26ed59eaba7ec683997083d33b156d11.bin) | Initial Firmware |
| ATK X1 PRO | `373b:1016` | x1 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/a98e677abff4d018d8f62ea33aa68f8e.bin) | 6月第1次 固件更新： 1、更新绝鲨竞技固件MAX≥20000fps |
| ATK X1 PRO MAX | `373b:1017` | x1 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/b7ac93af6b13265a9b1abeef44960e00.bin) | 6月第1次 固件更新： 1、更新绝鲨竞技固件MAX≥20000fps |
| ATK X1 S NK | `373b:1106` | x1 | 1.26 | [download](https://bpcdn.atkgear.com/hub-cloud/file/91ba5fbbe486140288f721694ae62973.bin) | 1、修复部分情况下电脑关机开机后需重新拔插接收器问题 |
| ATK X1 S NK | `373b:1106` | x1 | 1.21 | [download](https://bpcdn.atkgear.com/hub-cloud/file/9403ff66353b3d6d34657b31879f02f9.bin) | 8月第1次 固件更新： 1、按键功能修改后马上切换配置，有概率按键修改失败 |
| ATK X1 S NK | `373b:1106` | x1 | 1.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/492c4baba0e8873e8e2c3efd3c554120.bin) | 6月第1次固件更新： 1、解bug：鼠标使用过程中按键会漏键； 2、解bug：鼠标休眠起来一地个按键会漏键； 3、解bug：鼠标休眠起来回报率低，导致光标飘； |
| ATK X1 S NK | `373b:1106` | x1 | 1.11 | [download](https://bpcdn.atkgear.com/hub-cloud/file/bf0c0f8576e6e64a6d156b06084a3241.bin) | 4月第1次 固件更新： 1.增强鼠标抗干扰能力 2.优化鼠标回连速度 3.修复了一些已知问题 |
| ATK X1 SE Nearlink | `373b:1299` | x1 | 1.0.18 | [download](https://bpcdn.atkgear.com/hub-cloud/file/ebe8273a50680a996b4e0e8ef411290c.bin) | Daily update |
| ATK X1 SE Nearlink | `373b:1299` | x1 | 1.0.16 | [download](https://bpcdn.atkgear.com/hub-cloud/file/26db1095faac9e222a41e2af5cadec45.bin) | 日常更新 |
| ATK X1 SE NK | `373b:1107` | x1 | 1.26 | [download](https://bpcdn.atkgear.com/hub-cloud/file/3469340b5f5667922aaffb07e50df671.bin) | 修复部分情况下电脑关机开机后需重新拔插接收器问题 |
| ATK X1 SE NK | `373b:1107` | x1 | 1.21 | [download](https://bpcdn.atkgear.com/hub-cloud/file/ce7b7ea1596330d0f5482340651d8c22.bin) | 8月第1次 固件更新： 1、按键功能修改后马上切换配置，有概率按键修改失败 |
| ATK X1 SE NK | `373b:1107` | x1 | 1.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/fbb46379bc4f073b9ddbb04c426d9dbc.bin) | 6月第1次固件更新： 1、解bug：鼠标使用过程中按键会漏键； 2、解bug：鼠标休眠起来一地个按键会漏键； 3、解bug：鼠标休眠起来回报率低，导致光标飘； |
| ATK X1 SE NK | `373b:1107` | x1 | 1.11 | [download](https://bpcdn.atkgear.com/hub-cloud/file/722d21a0a36a53cb54fb1baa28403a77.bin) | 4月第1次 固件更新： 1.增强鼠标抗干扰能力 2.优化鼠标回连速度 3.修复了一些已知问题 |
| ATK X1 SE NK | `373b:130e` | x1 | 1.0.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/f858b4f4896555f584f6f34620e95ca9.bin) | Initial Firmware |
| ATK X1 Ultimate | `373b:103d` | x1 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/3819fca8dcfb28b127b998b7291dfc3a.bin) | 6月第1次 固件更新： 1、更新绝鲨竞技固件MAX≥20000fps |
| ATK X1 Ultimate 2.0 | `373b:11e7` | x1 | 3.03 | [download](https://bpcdn.atkgear.com/hub-cloud/file/48a6ce24f51bb3f8b97c7d4257682ff3.bin) | 1、更新宏录制按键不释放问题 |
| ATK X1 Ultimate 2.0 | `373b:11e7` | x1 | 3.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/f0a71d2ec22ceb0754f20409e720963a.bin) | 10月第1次3.00固件更新： 1、优化抗干扰能力 注意：由于优化了设备底层，对应接收器固件版本需要同步升级到V3.00以上 |
| ATK X1 Ultimate 2.0 + | `373b:1286` | x1 | 5.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/8a172bb44d2fb1751753f8ab09f6ff74.bin) | Initial Firmware |
| ATK X1 Ultra | `373b:102f` | x1 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/f9f6e402ca330504f0b8fc6cfc4215ee.bin) | 6月第1次 固件更新： 1、更新绝鲨竞技固件MAX≥20000fps |
| ATK X1 Ultra Max 2.0 | `373b:11ec` | x1 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/21698bf239a9c11bf20a9602122c6304.bin) | 10月第1次3.01固件更新： 1、优化抗干扰能力 注意：由于优化了设备底层，对应接收器固件版本需要同步升级到V3.00以上 |
| ATK X1 Ultra Max 2.0 | `373b:1274` | x1 | 3.03 | [download](https://bpcdn.atkgear.com/hub-cloud/file/3ea1c943fc9a9a4be3133bfe7c18b226.bin) | 出厂固件 |
| ATK Y9 Ultimate | `373b:11cf` | y9 | 3.03 | [download](https://bpcdn.atkgear.com/hub-cloud/file/2268c9ce8269a9817cb016e53e4a332d.bin) | 1、更新宏录制按键不释放问题 |
| ATK Y9 Ultimate | `373b:11cf` | y9 | 3.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/0ebf1977fabaf60154b40608520f7b20.bin) | 1、优化了抗干扰能力 注意：由于优化了设备底层，对应接收器鼠标固件版本需要同步升级到V3.00以上 |
| ATK Z1 PRO MAX | `373b:1019` | z1 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/2fd433c532314bafd5ddf810c4365b5f.bin) | 6月第1次 固件更新： 1、更新绝鲨竞技固件MAX≥20000fps |
| ATK Z1 Ultimate 2.0 | `373b:1201` | z1 | 3.03 | [download](https://bpcdn.atkgear.com/hub-cloud/file/3fcd2a0820ae534e18e1c18b4f0de908.bin) | 1、更新宏录制按键不释放问题 |
| ATK Z1 Ultimate 2.0 | `373b:1201` | z1 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/4d18f972b2b6a9c760f8cc9a45758483.bin) | 12月第1次3.01固件更新： 1、优化抗干扰能力 注意：由于优化了设备底层，对应接收器固件版本需要同步升级到V3.00以上 |
| ATK Z1 Ultra | `373b:104a` | z1 | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/f14a586f0a4dc6995681d0b5446afde4.bin) | 6月第1次 固件更新： 1、更新绝鲨竞技固件MAX≥20000fps |
| ATK ZERO | `373b:1154` | zero | 3.0.3 | [download](https://bpcdn.atkgear.com/hub-cloud/file/13118c656e6d483e1416c8a9f3d57752.bin) | 修复已知问题 |
| ATK ZERO | `373b:1154` | zero | 3.0.0 | [download](https://bpcdn.atkgear.com/hub-cloud/file/bb961fbeb9002f9cfe744e6329ead123.bin) | 1、优化鼠标无线唤醒延迟 2、修复一些已知问题 |
| ATK ZERO EX | `373b:11cc` | duckbill | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/bfae3ff20584a21ae09ebab4f62880f6.bin) | 出厂固件 |
| ATK ZERO EX + | `373b:1289` | zero | 5.21 | [download](https://bpcdn.atkgear.com/hub-cloud/file/8e3f69ec55e36cc9e021deb437bf334a.bin) | 初始固件 |
| MAD R | `373b:132b` | mad-r | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/ed488e313ecd163c7bccd9a624af091a.bin) | 日常更新 |
| MAD R + | `373b:104b` | mad-r | 3.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/8864c409deec6adc57553385e680a9ce.bin) | 9月第1次 固件更新： 1、更新绝鲨固件MAX 2、新增传感器旋转功能 |
| MAD R MAJOR | `373b:103e` | mad-r | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/907471b05a3ad1caacd5f7507181fe21.bin) | 6月第1次 固件更新： 1、更新绝鲨竞技固件MAX≥20000fps |
| MAD R MAJOR+ | `373b:104c` | mad-r | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/daf071e91d8e8abae38af86d723b1cdd.bin) | 6月第1次 固件更新： 1、更新绝鲨竞技固件MAX≥20000fps |
| Mouse | `373b:1366` | v3 | 1.0.22 | [download](https://bpcdn.atkgear.com/hub-cloud/file/b98a1172f489bcfd88f6912496524e14.bin) | Initial Firmware |
| Mouse | `373b:1367` | v3 | 1.0.22 | [download](https://bpcdn.atkgear.com/hub-cloud/file/9a615d0587ccadced081e1fa0a498c5a.bin) | Initial Firmware |
| NK mouse 8K NANO dongle | `373b:11dc` | dongle | 1.0.19 | [download](https://bpcdn.atkgear.com/hub-cloud/file/11ebd42274ac259dad22bb570677c27a.bin) | 日常更新 |
| NK mouse 8K NANO dongle | `373b:11dc` | dongle | 1.0.17 | [download](https://bpcdn.atkgear.com/hub-cloud/file/11429343fec85601308fc7267a478b33.bin) | 修复部分情况下电脑休眠唤醒问题 |
| NK mouse 8K NANO dongle | `373b:11dc` | dongle | 1.0.13 | [download](https://bpcdn.atkgear.com/hub-cloud/file/2f8c8ef48fd3b55ecd7e57110942f00c.bin) | 修复已知问题 |
| NK mouse 8K NANO dongle | `373b:11dc` | dongle | 1.0.12 | [download](https://bpcdn.atkgear.com/hub-cloud/file/fe1ffb4b29f4cc3fa1b39cc60f727ebc.bin) | 优化充满后偶尔闪黄灯的问题 |
| NK Mouse Dongle | `373b:10c9` | dongle | 1.23 | [download](https://bpcdn.atkgear.com/hub-cloud/file/85d18f56d02b27393f55fee41ec914f6.bin) | 修复部分情况下接收器无法识别问题 |
| NK Mouse Dongle | `373b:10c9` | dongle | 1.22 | [download](https://bpcdn.atkgear.com/hub-cloud/file/24a9af9309e9646751966598f0b3a09d.bin) | 1、日常更新 |
| NK Mouse Dongle | `373b:10c9` | dongle | 1.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/df42a71acc31f6d2c8365c4a9dffea41.bin) | 8月第1次 固件更新： 1、按键功能修改后马上切换配置，有概率按键修改失败 |
| NK Mouse Dongle | `373b:10c9` | dongle | 1.19 | [download](https://bpcdn.atkgear.com/hub-cloud/file/2747132b4124673f52879475812c85de.bin) | 4月第3次 固件更新： 1、修复已知问题 |
| NK Mouse Dongle | `373b:10c9` | dongle | 1.17 | [download](https://bpcdn.atkgear.com/hub-cloud/file/25152eb17e7b800315fb875d75f3c280.bin) | 4月第3次 固件更新： 1.增强鼠标抗干扰能力 2.优化鼠标回连速度 3.修复了一些已知问题 |
| NK Mouse Dongle | `373b:10c9` | dongle | 1.15 | [download](https://bpcdn.atkgear.com/hub-cloud/file/4e102b1025b37ee27bafc4b1335b82d4.bin) | 4月第2次 固件更新： 1.增强鼠标抗干扰能力 2.优化鼠标回连速度 3.修复了一些已知问题 |
| NK Mouse Dongle | `373b:10c9` | dongle | 1.13 | [download](https://bpcdn.atkgear.com/hub-cloud/file/79008453958f656aa701911a83e638d8.bin) | 4月第1次 固件更新： 1、出厂固件 |
| NK mouse NANO dongle | `373b:1216` | dongle | 1.0.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/ff1a3c3c484752f714379be3b58a6dba.bin) | Daily update |
| NK mouse NANO dongle | `373b:1216` | dongle | 1.0.19 | [download](https://bpcdn.atkgear.com/hub-cloud/file/45799af47e1d79723db1d52a8abed973.bin) | 日常更新 |
| NK mouse NANO dongle | `373b:1216` | dongle | 1.0.17 | [download](https://bpcdn.atkgear.com/hub-cloud/file/98089357a86561de5bc8fb6b2f47b46d.bin) | 修复部分情况下异常唤醒电脑问题 |
| NK mouse NANO dongle | `373b:1216` | dongle | 1.0.12 | [download](https://bpcdn.atkgear.com/hub-cloud/file/d106da8eb0510dd032d15360cc62a27a.bin) | 出厂固件 |
| NK mouse NANO dongle | `373b:133f` | dongle | 1.0.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/8e5ea9fb4af12e991c51e7033ac4dbf4.bin) | Daily update |
| NK mouse NANO dongle | `373b:133f` | dongle | 1.0.19 | [download](https://bpcdn.atkgear.com/hub-cloud/file/234b07240b49468d2e40389bb6318dc7.bin) | Initial Firmware |
| VXE R1 / VXE R1SE / VXE R1SE+ | `3554:f58f` | r1 | 3.13 | [download](https://bpcdn.atkgear.com/hub-cloud/file/64ff9cd523604194782b5756b0f6ea89.bin) | 9月第1次3.13固件更新： 更新内容： 1.修复无法指定切换配置文件问题 |
| VXE R1 / VXE R1SE / VXE R1SE+ | `3554:f58f` | r1-se+ | 3.15 | [download](https://bpcdn.atkgear.com/hub-cloud/file/51dd6a83ff06a3742a88d5822a60e6e9.bin) | 1月第1次3.15固件更新： 更新内容： 1.日常更新 |
| VXE R1 / VXE R1SE / VXE R1SE+ | `3554:f58f` | r1-se+ | 3.14 | [download](https://bpcdn.atkgear.com/hub-cloud/file/4aa1714a1c2fcd77360859e35bb1edbd.bin) | 8月第1次3.14固件更新： 更新内容： 1.修复无法指定切换配置文件问题 |
| VXE R1 NK | `373b:10c7` | r1 | 1.27 | [download](https://bpcdn.atkgear.com/hub-cloud/file/663d8b9715070c73e5996d623675584d.bin) | 修复部分情况下电脑开机后接收器无响应问题 |
| VXE R1 NK | `373b:10c7` | r1 | 1.25 | [download](https://bpcdn.atkgear.com/hub-cloud/file/b1c2d22569323c5c4239f301681c5b8e.bin) | 1、解决部分情况下，电脑开关机需要重新拔插接收器问题 |
| VXE R1 NK | `373b:10c7` | r1 | 1.21 | [download](https://bpcdn.atkgear.com/hub-cloud/file/6502d8e89b91377e0dd250494e53d81f.bin) | 8月第1次 固件更新： 1、按键功能修改后马上切换配置，有概率按键修改失败 |
| VXE R1 NK | `373b:10c7` | r1 | 1.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/9aa343cb331470767954ddffb0d1f560.bin) | 6月第1次固件更新： 1、解bug：鼠标使用过程中按键会漏键； 2、解bug：鼠标休眠起来一地个按键会漏键； 3、解bug：鼠标休眠起来回报率低，导致光标飘； |
| VXE R1 NK | `373b:10c7` | r1 | 1.13 | [download](https://bpcdn.atkgear.com/hub-cloud/file/53ec643461d8a37033746cff2e5b819d.bin) | 4月第1次 固件更新： 1.增强鼠标抗干扰能力 2.优化鼠标回连速度 3.修复了一些已知问题 |
| VXE R1 PRO / VXE R1 PRO MAX | `3554:f58c` | r1-pro | 1.23 | [download](https://bpcdn.atkgear.com/hub-cloud/file/029e6ddf1a0d2669ae1d908024162307.bin) | 更新内容： 1、修复已知问题，优化使用体验 |
| VXE R1 PRO / VXE R1 PRO MAX | `3554:f58c` | r1-pro-max | 1.21 | [download](https://bpcdn.atkgear.com/hub-cloud/file/cea5d2bd9cb3b864b4cbdae7cf706c08.bin) | 9月第1次1.21固件更新： 更新内容： 1.修复无法指定切换配置文件问题 |
| VXE R1 S NK | `373b:121f` | r1s | 1.25 | [download](https://bpcdn.atkgear.com/hub-cloud/file/ef1743fa5c11e6961fa869bcfc541da1.bin) | 1、解决部分情况下，电脑开关机需要重新拔插接收器问题 |
| VXE R1 S NK | `373b:1310` | r1s | 1.0.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/8160eec22fd3e7efaca9b9fcab72731d.bin) | Initial Firmware |
| VXE R1 SE+ | `373b:12dc` | r1 | 1.0.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/2594548c4dbec6766be71ccb55e5849d.bin) | Initial Firmware |
| VXE R2 SE NK | `373b:12b1` | r2 | 1.0.18 | [download](https://bpcdn.atkgear.com/hub-cloud/file/c1668b5e70b22aa6eacbce223abed595.bin) | 初始固件 |
| VXE V3 NK | `373b:10e7` | v3 | 1.30 | [download](https://bpcdn.atkgear.com/hub-cloud/file/8c12e31b860cc24828ebb7a3fa869d00.bin) | 修复部分情况下重启电脑接收器无响应问题 |
| VXE V3 NK | `373b:10e7` | v3 | 1.24 | [download](https://bpcdn.atkgear.com/hub-cloud/file/acc20e613cd086e35bf33d724bc81b13.bin) | 出厂固件 |
| VXE V3 NK | `373b:1213` | v3 | 1.0.15 | [download](https://bpcdn.atkgear.com/hub-cloud/file/3a32d2f1ba49f9f296123636635fba2a.bin) | 日常更新 |
| VXE V3 NK | `373b:12d2` | v3 | 1.0.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/51c7c6dce8687f78ad6eed399e38f25a.bin) | Initial Firmware |
| VXE V3 PRO Max | `373b:127b` | v3 | 1.0.15 | [download](https://bpcdn.atkgear.com/hub-cloud/file/e41119ae698bcc43ebc0867001ef50e3.bin) | 日常更新 |
| VXE V3 PRO NK | `373b:10e8` | v3 | 1.30 | [download](https://bpcdn.atkgear.com/hub-cloud/file/51e864e1d4f8b820f899d162536c6c24.bin) | 修复部分情况下重启电脑接收器无响应问题 |
| VXE V3 PRO NK | `373b:10e8` | v3 | 1.23 | [download](https://bpcdn.atkgear.com/hub-cloud/file/203d1a12c5477fbed5de6d5f720ad57a.bin) | 出厂固件 |
| VXE V3 PRO NK | `373b:1214` | v3 | 1.0.15 | [download](https://bpcdn.atkgear.com/hub-cloud/file/0519e0b7b5de907f9cc46e2449b4170f.bin) | 日常更新 |
| VXE V3 PRO NK | `373b:1306` | v3 | 1.0.20 | [download](https://bpcdn.atkgear.com/hub-cloud/file/090728d1201ddbc2260092bc37753219.bin) | Initial Firmware |
| Wireless mouse -8K NANO dongle | `373b:111b` | dongle | 2.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/b25fa6ebd458ebac9d9bda7533405c1a.bin) | 9月第1次 固件更新： 1、修复已知问题 |
| Wireless mouse -8K TOWER dongle | `373b:11f4` | dongle | 2.10 | [download](https://bpcdn.atkgear.com/hub-cloud/file/822717fcb8880ae14949165da1bc4462.bin) | 1、日常更新 |
| Wireless mouse -8K TOWER dongle | `373b:11f4` | dongle | 2.09 | [download](https://bpcdn.atkgear.com/hub-cloud/file/403dbec2df564d66d62a0b954792d255.bin) | 1、日常更新 |
| Wireless mouse -8K TOWER dongle | `373b:11f4` | dongle | 2.06 | [download](https://bpcdn.atkgear.com/hub-cloud/file/92097e7c1137b82ea6f059408455d2ad.bin) | 1、默认固件 |
| Wireless mouse 8k dongle-G | `373b:12ea` | dongle | 3.1.5 | [download](https://bpcdn.atkgear.com/hub-cloud/file/71adde436042e08bade4e6c848545beb.bin) | 初始固件 |
| Wireless mouse 8k dongle-H | `373b:11d8` | dongle | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/151c22084d88c736755dc954496e37b0.bin) | 修复已知问题，优化使用体验 |
| Wireless mouse 8k dongle-H | `373b:11d8` | dongle | 3.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/486f28c69b499a5b2f8c5432e0298364.bin) | 10月第1次3.00固件更新： 1、优化抗干扰能力 注意：由于优化了设备底层，对应鼠标固件版本需要同步升级到V3.00以上 |
| Wireless mouse 8k dongle-H | `373b:11d8` | dongle | 2.02 | [download](https://bpcdn.atkgear.com/hub-cloud/file/28f68c157518b6f5b8fe78629c57acd4.bin) | 9月第1次2.02固件更新： 1、出厂固件 |
| Wireless mouse 8k dongle-H | `373b:12cc` | dongle | 5.02 | [download](https://bpcdn.atkgear.com/hub-cloud/file/1209c1cfe613f2219349d1cddae7fb6d.bin) | Initial Firmware |
| Wireless mouse 8k dongle-L | `373b:11d9` | dongle | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/954a5d0f41b791fb61129de7c5da82f1.bin) | 1、更新宏录制按键不释放问题 |
| Wireless mouse 8k dongle-L | `373b:11d9` | dongle | 3.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/ff531ccf0afe34adfee291e1b9d2fef6.bin) | 10月第1次3.00固件更新： 1、优化抗干扰能力 注意：由于优化了设备底层，对应鼠标固件版本需要同步升级到V3.00以上 |
| Wireless mouse 8k dongle-L | `373b:11d9` | dongle | 2.08 | [download](https://bpcdn.atkgear.com/hub-cloud/file/d41f7348e39bc2d2d2804c78b7de139d.bin) | 9月第1次2.08固件更新： 1、修改轮询率灯效顺序 |
| Wireless mouse 8k dongle-L | `373b:1278` | dongle | 5.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/6dcaa6778f8c3e6b2746af19da0c759f.bin) | 出厂固件 |
| Wireless mouse 8k dongle-L0 | `373b:124f` | dongle | 3.0.4 | [download](https://bpcdn.atkgear.com/hub-cloud/file/80752a183b6146c76aa2130d66ed0ee1.bin) | 出厂固件 |
| Wireless mouse 8k dongle-L1 | `373b:1155` | dongle | 3.0.2 | [download](https://bpcdn.atkgear.com/hub-cloud/file/252a4cc459d8ac5c85e612301be355cd.bin) | 修复已知问题 |
| Wireless mouse 8k dongle-L1 | `373b:1155` | dongle | 3.0.0 | [download](https://bpcdn.atkgear.com/hub-cloud/file/16231c658b2a4050993295c1e79b717f.bin) | 1、优化鼠标无线唤醒延迟 2、修复一些已知问题 |
| Wireless mouse 8k dongle-M1 | `373b:12f5` | dongle | 3.1.5 | [download](https://bpcdn.atkgear.com/hub-cloud/file/1f431f899e0f7ffc3bceab47dd7013f9.bin) | 1. Optimize the receiver light effects 2. Improve connection stability Note: Use the current version. The mouse firmware |
| Wireless mouse 8k dongle-M1 | `373b:12f5` | dongle | 3.0.8 | [download](https://bpcdn.atkgear.com/hub-cloud/file/fd5dc76bb8af988e7efb8ced27907eca.bin) | 日常更新 |
| Wireless mouse 8k dongle-M1 | `373b:12f5` | dongle | 3.0.7 | [download](https://bpcdn.atkgear.com/hub-cloud/file/28b7b1c5d15f45b4d2d020087e289b38.bin) | Initial Firmware |
| Wireless mouse 8k NANO dongle-L | `373b:11fd` | dongle | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/e5daaf63417e8aee17625a6216ebc0da.bin) | 1、更新宏录制按键不释放问题 |
| Wireless mouse 8k NANO dongle-L | `373b:11fd` | dongle | 3.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/a5f2083f5a3172c1b607b994eb26178c.bin) | 10月第1次3.00固件更新： 1、优化抗干扰能力 注意：由于优化了设备底层，对应鼠标固件版本需要同步升级到V3.00以上 |
| Wireless mouse 8k NANO dongle-L | `373b:11fe` | dongle | 3.01 | [download](https://bpcdn.atkgear.com/hub-cloud/file/ed81ea09bd26108a75b7f3aace2af279.bin) | 1、更新宏录制按键不释放问题 |
| Wireless mouse 8k NANO dongle-L | `373b:11fe` | dongle | 3.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/e1ddf2bd743f0f211f26f3297b92a01d.bin) | 10月第1次3.00固件更新： 1、优化抗干扰能力 注意：由于优化了设备底层，对应鼠标固件版本需要同步升级到V3.00以上 |
| Wireless mouse 8k NANO dongle-M1 | `373b:12cd` | dongle | 3.1.5 | [download](https://bpcdn.atkgear.com/hub-cloud/file/c671d352ab4689437d643368de70875b.bin) | 1. Optimized receiver lighting effects 2. Improved mouse response speed |
| Wireless mouse 8k NANO dongle-M1 | `373b:12cd` | dongle | 3.0.6 | [download](https://bpcdn.atkgear.com/hub-cloud/file/3e98408baca6d699fabf81e41ea8eb82.bin) | Initial Firmware |
| YOGO 75 | `373b:119c` | device | 0116 | [download](https://bpcdn.atkgear.com/hub-cloud/file/95d860609bad1469ba72536993f528da.bin) | Fix the issue of Bluetooth failing to reconnect in some cases |
| YOGO 75 | `373b:119c` | device | 0115 | [download](https://bpcdn.atkgear.com/hub-cloud/file/e33ff12ff5defdf3f119619b7c94e7eb.bin) | 1.修复MAC模式下，右Alt键不触发win键问题 |
| YOGO 75 | `373b:119c` | device | 0104 | [download](https://bpcdn.atkgear.com/hub-cloud/file/7eb9f1ebcbee7b673e89d7dc0a182c2b.bin) | via固件 |
| YOGO 75 | `373b:119c` | device | 0105 | [download](https://bpcdn.atkgear.com/hub-cloud/file/378445ee16953e433230db76f92b682e.bin) | via固件 1、修复录制宏输出逻辑错误问题 |
| YOGO 75 | `373b:1200` | device | 1.13 | [download](https://bpcdn.atkgear.com/hub-cloud/file/0407c21843f23788afbc38c2b21c1a3b.bin) | 日常更新 |
| YOGO 75 | `373b:1200` | device | 1.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/8b4401714ff519aa8715615a2f4b86a9.bin) | via固件 |
| YOGO 75 PRO | `373b:119b` | device | 1.26 | [download](https://bpcdn.atkgear.com/hub-cloud/file/2cd76d136a4d6d881dbecb086e993dda.bin) | Fix the issue of Bluetooth not reconnecting in some cases |
| YOGO 75 PRO | `373b:119b` | device | 1.24 | [download](https://bpcdn.atkgear.com/hub-cloud/file/dcda9d458b7e9059c948e5e224480fc0.bin) | 日常更新 |
| YOGO 75 PRO | `373b:119b` | device | 1.06 | [download](https://bpcdn.atkgear.com/hub-cloud/file/6cc64767483b97c53f80139332ed941f.bin) | via固件 |
| YOGO 75 PRO | `373b:119b` | device | 1.03 | [download](https://bpcdn.atkgear.com/hub-cloud/file/2245f66944d6255b9b724991f4c6c362.bin) | via固件 |
| YOGO 75 PRO | `373b:11ff` | device | 1.00 | [download](https://bpcdn.atkgear.com/hub-cloud/file/c02e676e220c798a5ed72e4e30e14405.bin) | via固件 |
