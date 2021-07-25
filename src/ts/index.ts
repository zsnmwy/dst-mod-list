import {PrismaClient} from '@prisma/client'
import * as fs from "fs";
import axios from "axios";
import {parse} from 'node-html-parser';

const tablemark = require('tablemark')

const prisma = new PrismaClient()
const Download_MOD_By_UUID_URL = 'https://backend-02-prd.steamworkshopdownloader.io/api/download/request'
const xpath = require('xpath')
    , dom = require('xmldom').DOMParser
// @ts-ignore
const getInfoFail: [Mod] = []
// @ts-ignore
const needUpdate: [Mod] = []

const headers = {
    'authority': 'backend-02-prd.steamworkshopdownloader.io',
    'pragma': 'no-cache',
    'cache-control': 'no-cache',
    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
    'sec-ch-ua-mobile': '?0',
    'upgrade-insecure-requests': '1',
    'dnt': '1',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.164 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'sec-fetch-site': 'same-site',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-dest': 'document',
    'referer': 'https://steamworkshopdownloader.io/',
    'accept-language': 'zh-CN,zh;q=0.9,ja;q=0.8',
    'cookie': '_72986=http://172.19.0.4:8080; _72986=http://172.19.0.4:8080'
}

function delay(t: number) {
    return new Promise<void>(function (resolve) {
        setTimeout(function () {
            resolve();
        }, t);
    });
}

class Mod {
    id: number
    ModId: number
    name: string
    version: string
    needUpdate: boolean
    size: string

    constructor(ModId: number) {
        // @ts-ignore
        return (async () => {
            this.ModId = ModId
            const mod = await prisma.mod.findFirst({
                where: {
                    ModId: this.ModId
                }
            })
            this.version = mod?.version || ''
            this.id = mod?.id || -1
            this.name = mod?.name || ''
            await this.getModInfo()
            return this;
        })();
    }

    getModInfo = async (): Promise<void> => {

        try {
            console.log(`
👉 Start Get Mod Information - ${this.ModId}
`)
            const result = await axios.get(`https://steamcommunity.com/sharedfiles/filedetails/?id=${this.ModId}`)
            const html = result.data
            if (html.match('Steam Community :: Error')) return console.log('NOT Existing MOD')

            const root = parse(html)
            this.name = root.querySelector('div.workshopItemTitle').text
            const doc = new dom({
                errorHandler: {
                    warning: () => {
                    },
                    error: () => {
                    },
                    fatalError: () => {
                    },
                },
            }).parseFromString(html)
            const node = xpath.select("string(//*[@id=\"mainContents\"]/div[10]/div/div[2]/div[2]/div/a)", doc) || xpath.select("string(/html/body/div[1]/div[7]/div[5]/div[1]/div[4]/div[10]/div/div[2]/div[1]/div/a)", doc) || xpath.select("string(/html/body/div[1]/div[7]/div[5]/div[1]/div[4]/div[10]/div/div[2]/div[2]/div/a[2])", doc) || xpath.select("//*[@id=\"mainContents\"]/div[10]/div/div[2]/div[2]/div/a[2]", doc)
            const latestVersion = node.split(':')[1]
            if (latestVersion !== this.version) {
                this.needUpdate = true
                this.version = latestVersion
                needUpdate.push(this)
            }
            this.size = xpath.select("string(//*[@id=\"mainContents\"]/div[10]/div/div[2]/div[4]/div[2]/div[1])", doc) || xpath.select("string(/html/body/div[1]/div[7]/div[5]/div[1]/div[4]/div[10]/div/div[2]/div[3]/div[2]/div[1])", doc)
            console.log(`Mod ID: ${this.ModId}
Mod Name: ${this.name}
Mod Version: ${this.version}
Mod Size: ${this.size}
            `)
        } catch (e) {
            console.log(e);
            getInfoFail.push(this)
        }

    }

    download = async () => {
        try {

            // Get Download UUID By Mod ID

            console.log(`👉 Get UUID by MOD ID ${this.ModId}`)
            const result = await axios.post(Download_MOD_By_UUID_URL, {
                "publishedFileId": this.ModId,
                "collectionId": null,
                "extract": true,
                "hidden": false,
                "direct": false,
                "autodownload": false
            })

            // @ts-ignore
            const uuid = result.data.uuid
            console.log(`🚀 Mod ID ${this.ModId} - UUID ${uuid}`);
            await delay(5000)

            // Download MOD By UUID
            console.log(`👉 Start Download ${this.ModId}`)
            const writer = fs.createWriteStream(`public/mod/workshop-${this.ModId}.zip`)
            const res = await axios.get(`https://backend-02-prd.steamworkshopdownloader.io/api/download/transmit`, {
                params: {uuid},
                responseType: 'stream',
                headers
            })
            await res.data.pipe(writer)
            console.log(`🚀 Download complete ${this.ModId}`)
            await this.updateDBRecord()
        } catch (e) {
            console.log(e);
            console.error(`💥 Failed to download ${this.ModId}`)
            getInfoFail.push(this)
        }
    }

    updateDBRecord = async () => {
        try {
            const mod = await prisma.mod.findFirst({
                where: {
                    ModId: this.ModId
                }
            })

            if (mod) {
                console.log(`Update Record: ${this.ModId} ${this.version}`)
                await prisma.mod.update({
                    where: {
                        id: mod.id
                    },
                    data: {
                        ModId: this.ModId,
                        name: this.name,
                        version: this.version,
                        size: this.size
                    }
                })
            } else {
                console.log(`New Mod - Add Record: ${this.ModId} ${this.version}`)
                await prisma.mod.create({
                    data: {
                        ModId: this.ModId,
                        name: this.name,
                        version: this.version,
                        size: this.size
                    }
                })
            }
        } catch (e) {
            console.log(e);
        }


    }

}


async function main() {

    const result = fs.readFileSync(__dirname + '/../../public/top-mod-item.txt');
    const modId = result.toString().split('\n')
    modId.pop()

    let index = 0
    for (const id of modId) {
        index += 1
        console.log(`
👉 No.${index} ID ${id}`)

        let tmpId = parseInt(id)
        let mod = await new Mod(tmpId);

        if (mod.needUpdate) {
            await mod.download()
        }
        await delay(10000)
    }

    for (const infoFailElement of getInfoFail) {
        await infoFailElement.getModInfo()

        if (infoFailElement.needUpdate) {
            await infoFailElement.download()
        }

        await delay(10000)
    }

    const allModIds = await prisma.mod.findMany({
        select: {
            ModId: true,
            name: true,
            version: true,
            size: true
        }
    })

    allModIds.forEach(mod => {
        // @ts-ignore
        mod['FastGit'] = `[Download By FastGit](https://raw.fastgit.org/zsnmwy/dst-mod-list/master/public/mod/workshop-${mod.ModId}.zip)`
        // @ts-ignore
        mod['GitHub'] = `[Download By Github](https://github.com/zsnmwy/dst-mod-list/raw/master/public/mod/workshop-${mod.ModId}.zip)`
    })

    const markdown = tablemark(allModIds)

    const ReadMe = `
# Dst Mod List

The most popular mods in the top 300.

Use GitHub Actions to automatically update every night.

## Thanks

- [Github](https://github.com/)
- [Steam Workshop Downloader](https://steamworkshopdownloader.io/)

## Mod Detail

**FastGit is available for quick download in China.**

${markdown}

`
    fs.writeFileSync('./Readme.md', ReadMe)
}


main()
    .catch(err => {
        throw err
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
