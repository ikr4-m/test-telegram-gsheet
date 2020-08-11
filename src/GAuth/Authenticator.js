const fs = require('fs')
const { google } = require('googleapis')

module.exports = class Authenticator {
  /**
   * @param {any} credentials
   * @param {string} tokenPath
   * @param {string[]} scopes
   */
  constructor (credentials, tokenPath, scopes) {
    this.credentials = credentials
    this.tokenPath = tokenPath
    this.scopes = scopes
    this.oauthClient = new google.auth.OAuth2(
      credentials.installed.client_id,
      credentials.installed.client_secret,
      credentials.installed.redirect_uris[0]
    )
  }

  checkTokenAvailable () {
    return new Promise((resolve, reject) => {
      fs.readFile(this.tokenPath, (err, data) => {
        err ? resolve(false) : resolve(true)
      })
    })
  }

  generateUrlOAuth () {
    return this.oauthClient.generateAuthUrl({
      access_type: 'offline',
      scope: this.scopes
    })
  }

  generateToken (code) {
    return new Promise((resolve, reject) => {
      this.oauthClient.getToken(code, (err, token) => {
        if (err) {
          reject(err)
        } else {
          this.oauthClient.setCredentials(token)
          fs.writeFile(this.tokenPath, JSON.stringify(token), (err) => {
            if (err) reject(err)
            else resolve(true)
          })
        }
      })
    })
  }

  /**
   * @param {(err: NodeJS.ErrnoException?, auth: import('googleapis').Auth.OAuth2Client) => void} callback 
   */
  execute (callback) {
    fs.readFile(this.tokenPath, (err, token) => {
      if (err) callback(err, undefined)
      else {
        this.oauthClient.setCredentials(JSON.parse(token))
        callback(undefined, this.oauthClient)
      }
    })
  }
}
