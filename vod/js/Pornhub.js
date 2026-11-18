// 如果扩展加密了要用成对的 //空格ignore 包裹

// ignore

//@name:Pornhub
// 网站主页，只有视频源扩展需要
//@webSite:https://cn.pornhub.com
// 版本号纯数字
//@version:1
// 备注，没有的话就不填
//@remark:嗅探源；列表/分类/搜索解析 + 详情页取直链，失败自动回退内置嗅探
// 加密 id，没有的话就不填
//@codeID:
// 使用的环境变量，没有的话就不填
//@env:
// 是否是AV 1是  0否
//@isAV:1
//是否弃用 1是  0否
//@deprecated:0

// ignore

// ignore
// 不支持导入，这里只是本地开发用于代码提示
import { } from '../core/uzVideo.js'
import { } from '../core/uzHome.js'
import { } from '../core/uz3lib.js'
import { } from '../core/uzUtils.js'
// ignore

// ============================================================
// Pornhub 影视源 (uzVideo type:101)
// 放置路径： vod/js/Pornhub.js
// 依赖： req / cheerio / Rep* 由 uz 运行时提供（见上方 import 提示）
// 设计要点：解析不依赖易变的 class 名，统一用 a[href*="view_video.php?viewkey="]
//           播放地址多策略提取 mp4/m3u8，失败回退 app 内置嗅探
// ============================================================

const appConfig = {
    // 请求头：绕过年龄确认门 + 模拟 PC
    get headers() {
        return {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Cookie': 'accessAgeDisclaimerPH=1;',
        }
    },
    // 播放头：必须带 Referer，防盗链
    get playHeaders() {
        return {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': this.webSite,
        }
    },

    _webSite: 'https://cn.pornhub.com',
    get webSite() {
        if (this._webSite.endsWith('/')) {
            this._webSite = this._webSite.substring(0, this._webSite.length - 1)
        }
        return this._webSite
    },
    set webSite(value) {
        this._webSite = value
    },

    _uzTag: '',
    get uzTag() {
        return this._uzTag
    },
    set uzTag(value) {
        this._uzTag = value
    },
}

// 一级分类：id 直接是相对路径，type_id 会原样回传到 getVideoList 的 args.url
// 分类 ID 来自站点 /categories 页面的真实 c= 参数
const firstClass = [
    { name: '推荐', id: '/' },
    { name: '最新', id: '/video?o=cm' },
    { name: '最热', id: '/video?o=ht' },
    { name: '高分', id: '/video?o=tr' },
    { name: '最多观看', id: '/video?o=mv' },
    { name: '熟女', id: '/video?c=28' },
    { name: '辣妈', id: '/video?c=29' },
    { name: '女同', id: '/video?c=27' },
    { name: '3P', id: '/video?c=65' },
    { name: '巨乳', id: '/video?c=8' },
    { name: '内射', id: '/video?c=15' },
    { name: '日本人', id: '/video?c=111' },
    { name: '黑人', id: '/video?c=17' },
    { name: '爆菊', id: '/video?c=35' },
    { name: '潮吹', id: '/video?c=69' },
    { name: '手淫', id: '/video?c=22' },
    { name: '巨屌', id: '/video?c=7' },
]

// ------------------------ 通用工具 ------------------------

function combineUrl(url) {
    url = url || ''
    if (url.startsWith('http')) return url
    if (url.startsWith('//')) return 'https:' + url
    if (url.startsWith('/')) return appConfig.webSite + url
    return appConfig.webSite + '/' + url
}

function buildListUrl(path, page) {
    const base = combineUrl(path)
    const sep = base.includes('?') ? '&' : '?'
    return base + sep + 'page=' + (page || 1)
}

function cleanUrl(str) {
    return String(str || '')
        .replace(/\\\//g, '/')
        .replace(/\\u002F/gi, '/')
        .replace(/\\u0026/gi, '&')
        .replace(/&amp;/g, '&')
        .replace(/\\\"/g, '"')
        .trim()
}

// 从图片节点的所有属性里挑出真实图片地址（phncdn 或常见图片后缀）
function parseImage($img) {
    if (!$img || !$img[0]) return ''
    const attrs = Object.values($img[0].attribs || {})
    for (const v of attrs) {
        const u = cleanUrl(v)
        if (/^(https?:)?\/\//i.test(u) && (u.includes('phncdn') || /\.(jpg|jpeg|png|webp|gif)/i.test(u))) {
            return u.startsWith('//') ? 'https:' + u : u
        }
    }
    return ''
}

// 核心列表解析：基于 viewkey 链接，不依赖 class
function parseVideoList(htmlStr) {
    const $ = cheerio.load(htmlStr || '')
    const seen = Object.create(null)
    const list = []

    $('a[href*="view_video.php"]').each(function () {
        const href = cleanUrl($(this).attr('href') || '')
        const m = href.match(/viewkey=([a-zA-Z0-9]+)/i)
        if (!m) return
        const key = m[1]
        if (seen[key]) return
        seen[key] = 1

        const img = $(this).find('img').first()
        let name = cleanUrl($(this).attr('title') || '')
        if (!name) name = cleanUrl(img.attr('alt') || '')
        if (!name) name = cleanUrl($(this).text() || '').replace(/\s+/g, ' ').trim()
        if (!name) return

        const pic = parseImage(img)
        list.push({
            vod_id: '/view_video.php?viewkey=' + key,
            vod_name: name.substring(0, 120),
            vod_pic: pic,
        })
    })

    return list
}

// 从详情页 HTML 提取播放直链（多重兜底）
function extractPlayUrls(html) {
    const out = []
    const add = (raw, label) => {
        const u = cleanUrl(raw)
        if (!/^https?:\/\//i.test(u)) return
        if (!/\.mp4/i.test(u) && !/\.m3u8/i.test(u)) return
        if (out.some((x) => x.url === u)) return
        out.push({ name: label || '正片', url: u })
    }
    let re, m

    // 1) playerConfig / videoUrl / contentUrl 字段
    re = /(?:videoUrl|video_url|contentUrl)["']?\s*[:=]\s*(["'])([^"']+\.(?:mp4|m3u8)[^"']*)\1/gi
    while ((m = re.exec(html))) add(m[2], '高清')

    // 2) <source src="...">
    re = /<source[^>]*?src=["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/gi
    while ((m = re.exec(html))) add(m[1], '正片')

    // 3) 裸 mp4 链接（含 \/ 转义）
    re = /https?:\\?\/\\?\/[^\s"'<>]+?\.mp4[^\s"'<>]*/gi
    while ((m = re.exec(html))) add(m[0], '备用')

    return out
}

// ------------------------ uzVideo 七个方法 ------------------------

async function getClassList(args) {
    const backData = new RepVideoClassList()
    try {
        backData.data = firstClass.map((c) => ({
            type_id: c.id,
            type_name: c.name,
            hasSubclass: false,
        }))
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}

async function getSubclassList(args) {
    const backData = new RepVideoSubclassList()
    try {
        backData.data = { class: [], filter: [] }
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}

async function getVideoList(args) {
    const backData = new RepVideoList()
    try {
        const url = buildListUrl(args.url, args.page)
        const resp = await req(url, { headers: appConfig.headers })
        const list = parseVideoList(resp.data || '')
        backData.data = list
        backData.total = list.length
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}

async function getSubclassVideoList(args) {
    const backData = new RepVideoList()
    try {
        // 本源未使用二级分类/筛选；如以后加入，走 buildListUrl 同样逻辑
        const url = buildListUrl(args.mainClassId || args.url, args.page)
        const resp = await req(url, { headers: appConfig.headers })
        backData.data = parseVideoList(resp.data || '')
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}

async function getVideoDetail(args) {
    const backData = new RepVideoDetail()
    try {
        const url = combineUrl(args.url)
        const resp = await req(url, { headers: appConfig.headers })
        const $ = cheerio.load(resp.data || '')

        let title = cleanUrl($('title').first().text() || '')
            .replace(/\s*[-|]\s*Pornhub.*$/i, '')
            .trim()
        if (!title) title = cleanUrl($('h1').first().text() || '').trim()
        if (!title) title = 'Pornhub 视频'

        let pic = cleanUrl($('meta[property="og:image"]').attr('content') || '')
        if (pic.startsWith('//')) pic = 'https:' + pic

        const intro = cleanUrl($('meta[name="description"]').attr('content') || '').substring(0, 300)

        backData.data = {
            vod_id: args.url,
            vod_name: title,
            vod_pic: pic,
            vod_play_from: 'Pornhub',
            vod_play_url: '正片$' + args.url,
            vod_content: intro,
        }
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}

async function getVideoPlayUrl(args) {
    const backData = new RepVideoPlayUrl()
    try {
        const url = combineUrl(args.url)
        const resp = await req(url, { headers: appConfig.headers })
        const html = resp.data || ''
        const found = extractPlayUrls(html)

        backData.headers = appConfig.playHeaders
        if (found.length > 0) {
            backData.data = found[0].url
            backData.urls = found.map((f) => ({
                name: f.name,
                url: f.url,
                headers: appConfig.playHeaders,
                isSniffer: false,
            }))
        } else {
            // 直链提取失败：交给 uz 内置嗅探器（打开页面抓 mp4 网络请求）
            backData.sniffer = {
                url: url,
                ua: appConfig.headers['User-Agent'],
                timeOut: 20,
                retry: 2,
            }
        }
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}

async function searchVideo(args) {
    const backData = new RepVideoList()
    try {
        const kw = encodeURIComponent(args.searchWord || '')
        const url = combineUrl('/video/search?search=' + kw) + '&page=' + (args.page || 1)
        const resp = await req(url, { headers: appConfig.headers })
        const list = parseVideoList(resp.data || '')
        backData.data = list
        backData.total = list.length
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}
