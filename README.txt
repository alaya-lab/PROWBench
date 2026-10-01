PROWBench — 最小运行目录

本目录可整体移动或复制，不依赖原 project_page 目录，无需 npm 或构建步骤。
保留 Benchmark、Gallery、首页 2:16 介绍视频、精选 57 个场景、480p/720p
画质、提示词、40 张首页示例图和当前论文。Benchmark 页面及其资源保持原样。
Gallery 保留 20 个 Verified-FF、25 个 Unverified-FF、6 个 Multi-view 和 6 个
Long horizon 场景，共 578 个方法输出（多视角按各相机计数，另含 2 个 H3 版本）。
场景名称仅显示标题，不附加编号或相机视角。没有 Git 历史、缓存、旧论文或
停用的排行榜资源。

本地运行（macOS）
1. 双击 start.command。需要 Python 3。
2. 浏览器自动打开本地网址，默认 http://127.0.0.1:8767/。
   如果端口已被占用，脚本会选择空闲端口并显示正确网址。
3. Gallery 下方点击 ▶ Play 播放。保持终端窗口打开；Ctrl+C 停止服务。

终端运行（macOS / Linux）
在本目录中执行：./start.command
不自动打开浏览器：./start.command --no-browser
指定端口：./start.command --port 8000

也可使用支持 HTTP Range 请求的静态服务器。start.command 已支持视频分段
读取和进度跳转；Python 自带的普通 http.server 不支持视频分段读取。
请通过 HTTP 访问：双击 index.html / gallery.html 的 file:// 方式不支持
Gallery 所需的场景及视频 fetch 请求。

部署
将本目录作为静态网站根目录，入口为 index.html。assets/ 必须一起上传，
所有文件保持相对路径。start.command 和 README.txt 不影响静态托管。
字体使用 Google Fonts；没有网络时会使用系统备用字体。页面、论文、图片、
提示词和全部视频均在本地，不依赖外部视频服务器。

导出校验
网站资源：2,355 个文件，961,905,465 bytes（约 0.962 GB，小于 1 GB）。
其中视频：1,328 个 MP4 文件（含首页介绍视频、两种画质及结构输入）。
所有保留场景继续提供完整的方法对比、结构输入、提示词及 480p/720p 画质。
精简只移除未保留场景的 Gallery 资源，不压缩视频或改动 Benchmark。
