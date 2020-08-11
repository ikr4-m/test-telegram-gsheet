const { Telegraf } = require('telegraf')
const Markup = require('telegraf/markup')
const Wizard = require('telegraf/scenes/wizard')
const session = require('telegraf/session')
const Stage = require('telegraf/stage')
const credentials = require('./GAuth/Secret/credentials.json')
const GAuth = require('./GAuth/Authenticator')
const { google } = require('googleapis')
require('dotenv/config')
require('console-stamp')(console)

const bot = new Telegraf(process.env.TOKEN)
const googleAuth = new GAuth(
  credentials,
  './src/GAuth/Secret/token.json',
  ['https://www.googleapis.com/auth/spreadsheets']
)

const checkToken = new Wizard(
  'CHECK_TOKEN',
  async ctx => {
    const result = await googleAuth.checkTokenAvailable()
    result ? ctx.reply('Token sudah ada!') : ctx.reply('Token belum ada!')
    return ctx.scene.leave()
  }
)
const generateToken = new Wizard(
  'GENERATE_TOKEN',
  async ctx => {
    ctx.wizard.state.code = ''
    await ctx.reply('Silahkan login terlebih dahulu lewat tautan di bawah ini dan kirimkan kode yang diberikan di sini.')
    await ctx.reply(
      googleAuth.generateUrlOAuth(),
      Markup.keyboard(['Batal']).oneTime().resize().extra()
    )
    return ctx.wizard.next()
  },
  async ctx => {
    ctx.wizard.state.code = ctx.message.text
    if (ctx.wizard.state.code === 'Batal') {
      await ctx.reply('Perintah berhasil dibatalkan', Markup.removeKeyboard().extra())
    } else {
      googleAuth.generateToken(ctx.wizard.state.code)
        .then(() => {
          ctx.reply('Token berhasil dimasukkan!', Markup.removeKeyboard().extra())
        })
        .catch(err => {
          console.log(err)
          ctx.reply(err.message, Markup.removeKeyboard().extra())
        })
    }
    return ctx.scene.leave()
  }
)
const lihatAnggota = new Wizard(
  'LIHAT_ANGGOTA',
  async ctx => {
    const id = ctx.message.text.split(' ').slice(1)[0]
    googleAuth.execute(async (err, auth) => {
      if (err) await ctx.reply('Token tidak ditemukan.')
      else {
        const sheets = google.sheets({ version: 'v4', auth: auth })
        sheets.spreadsheets.values.get({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          range: 'Data!A2:E'
        }, async (err, res) => {
          if (err) {
            await ctx.reply('Sepertinya ada kesalahan dengan server.\n' + err.message)
            console.error(err.message)
          } else {
            const data = res.data.values
            if (!id) {
              if (!data) {
                await ctx.reply('Data masih kosong.')
              } else {
                const cetak = data.map(anggota => `[${anggota[0]}] ${anggota[1]}`)
                await ctx.reply(`Daftar anggota:\n\n[ID] Nama\n${cetak.join('\n')}`)
              }
            } else {
              if (!data) {
                await ctx.reply('Data masih kosong')
              } else {
                const cetak = data.filter(anggota => anggota[0] === id)[0]
                if (cetak.length === 0) {
                  await ctx.reply('ID tidak ditemukan.')
                } else {
                  await ctx.reply(
                    `Daftar anggota:\n\nID: ${cetak[0]}\nNama: ${cetak[1]}\nAlamat: ${cetak[2]}\nPaket: ${cetak[3]}\nHarga: IDR ${cetak[4]}`
                  )
                }
              }
            }
          }
        })
      }
    })
    return ctx.scene.leave()
  }
)
const tambahAnggota = new Wizard(
  'TAMBAH_ANGGOTA',
  async ctx => {
    ctx.wizard.state.data = []

    // Ambil panjang terakhir
    googleAuth.execute(async (err, auth) => {
      if (err) await ctx.reply('Token tidak ditemukan.')
      else {
        const sheets = google.sheets({ version: 'v4', auth: auth })
        sheets.spreadsheets.values.get({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          range: 'Data!A2:E'
        }, async (err, res) => {
          if (err) {
            await ctx.reply('Sepertinya ada kesalahan dengan server.\n' + err.message)
            console.error(err.message)
            return ctx.scene.leave()
          } else {
            ctx.wizard.state.dataTerakhir = res.data.values
          }
        })
      }
    })

    // Ambil paket
    googleAuth.execute(async (err, auth) => {
      if (err) await ctx.reply('Token tidak ditemukan.')
      else {
        const sheets = google.sheets({ version: 'v4', auth: auth })
        sheets.spreadsheets.values.get({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          range: 'Paket Harga!A2:B'
        }, async (err, res) => {
          if (err) {
            await ctx.reply('Sepertinya ada kesalahan dengan server.\n' + err.message)
            console.error(err.message)
            return ctx.scene.leave()
          } else {
            ctx.wizard.state.paket = res.data.values
            const data = ctx.wizard.state.paket.map(paket => paket[0])
            await ctx.reply(
              `Silahkan masukkan data dengan parameter ini:\n\n[Nama]\n[Alamat]\n[Paket (${data.join(' | ')})]`
            )
            await ctx.reply(
              `Contoh:\n\nIkram\nJl. Mana Aja Boleh\n${data[Math.floor(Math.random() * data.length)]}`,
              Markup.keyboard(['Batal']).oneTime().resize().extra()
            )
          }
        })
      }
    })
    return ctx.wizard.next()
  },
  async ctx => {
    if (ctx.message.text === 'Batal') {
      await ctx.reply('Perintah berhasil dibatalkan', Markup.removeKeyboard().extra())
    } else {
      const panjangDataTerakhir = ctx.wizard.state.dataTerakhir ? ctx.wizard.state.dataTerakhir.length : 0
      const rowNumber = panjangDataTerakhir + 2
      const rangeHarapan = `Data!A${rowNumber}:E${rowNumber}`
      const newID = ctx.wizard.state.dataTerakhir
        ? parseInt(ctx.wizard.state.dataTerakhir[panjangDataTerakhir - 1][0]) + 1
        : 1
      const newData = ctx.message.text.split('\n')

      googleAuth.execute(async (err, auth) => {
        if (err) await ctx.reply('Token tidak ditemukan.')
        else {
          const sheets = google.sheets({ version: 'v4', auth: auth })
          sheets.spreadsheets.values.update({
            range: rangeHarapan,
            spreadsheetId: process.env.GOOGLE_SHEET_ID,
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: [
                [newID, newData[0], newData[1], newData[2], `=IFERROR(VLOOKUP($D${rowNumber};'Paket Harga'!$A$2:$B$4;2;FALSE);0)`]
              ]
            }
          })
            .then(async response => {
              if (response.status === 200) {
                await ctx.reply('Data berhasil ditambahkan!', Markup.removeKeyboard().extra())
              }
            })
            .catch(async err => {
              console.log(err)
              await ctx.reply(err.message, Markup.removeKeyboard().extra())
            })
        }
      })
    }
    return ctx.scene.leave()
  }
)

const stage = new Stage([
  checkToken, generateToken, lihatAnggota, tambahAnggota
])
bot.use(session())
bot.use(stage.middleware())

bot.command('hello', ctx => ctx.reply('Hello world!'))
bot.command('checkToken', Stage.enter('CHECK_TOKEN'))
bot.command('generateToken', Stage.enter('GENERATE_TOKEN'))
bot.command('lihatAnggota', Stage.enter('LIHAT_ANGGOTA'))
bot.command('tambahAnggota', Stage.enter('TAMBAH_ANGGOTA'))

bot.launch().then(() => {
  console.log('Bot telah diaktifkan!')
})
