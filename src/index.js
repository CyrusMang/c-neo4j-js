'use strict'

import url from 'url'
import http from 'http'
import querystring from 'querystring'

const query = (auth, method, _url, data) => {
    _url = url.parse(_url)
    let options = {
        host: _url.hostname,
        port: _url.port,
        path: _url.path,
        auth: auth,
        method: method,
        headers: {
            'Accept': 'application/json; charset=UTF-8',
            'Connection': 'keep-alive',
            'X-Stream': 'true'
        }
    }
    if (['PUT', 'PATCH', 'POST'].includes(method)){
        data = JSON.stringify(data)
        options.headers['Content-Type'] = 'application/json'
        options.headers['Content-Length'] = data.length
    } else {
        if (data) {
            options.path = `${options.path}?${querystring.stringify(data)}`
        }
    }
    return new Promise((resolve, reject) => {
        let str = ''
        const req = http.request(options, res => {
            res.body = ''
            res.on('data', chunk => str += chunk)
            res.on('end', () => {
                res.body = JSON.parse(str)
                resolve(res)
            })
        })
        req.on('error', error => reject(error))
        if (['PUT', 'PATCH', 'POST'].includes(method)){
            req.write(data)
        }
        req.end()
    })
}

export const stringify = data => {
    for (let [k, v] of Object.entries(data)) {
        if (!['boolean', 'number', 'string'].includes(typeof v)) {
            data[k] = encodeURI(JSON.stringify(v))
        }
    }
    return data
}

export default class Database{
    constructor(root, auth) {
        this.root = root
        this.auth = auth
        this._transaction = [0]
    }
    transaction() {
        ++this._transaction[0]
    }
    async cypher(_query, params) {
        let url = `${this.root.data}transaction`
        if (this._transaction[0] > 0) {
            if (this._transaction[1]) {
                url = this._transaction[1]
            }
        }else{
            url += '/commit'
        }
        const statements = {
            statements: [{
                statement: _query,
                parameters: params
            }]
        }
        const response = await query(this.auth, 'POST', url, statements)
        if (response.body.errors.length) {
            let messages = ''
            for (let error of response.body.errors){
                messages += error.message
            }
            throw new Error(`Database error : ${messages}`)
        } else {
            if (response.headers.location) {
                this._transaction[1] = response.headers.location
            }
            let results = []
            for (let result of response.body.results) {
                let rows = []
                for (let row of result.data) {
                    let data = {}
                    for (let index in row.row) {
                        data[result.columns[index]] = row.row[index]
                    }
                    rows.push(data)
                }
                results.push(rows)
            }
            if (results.length) {
                return results[0]
            }
            return null
        }
    }
    async commit() {
        if (this._transaction[0] > 1) {
            --this._transaction[0]
        } else if (this._transaction[0] == 1 && this._transaction[1]) {
            const response = await query(this.auth, 'POST', `${this._transaction[1]}/commit`, {statements:[]})
            if (response.body.errors.length) {
                let messages = ''
                for (let error of response.body.errors) {
                    messages += error.message
                }
                throw new Error(`Database error : ${messages}`)
            } else {
                this._transaction = [0]
                return true
            }
        } else {
            throw new Error('No statement exist.')
        }
    }
    async rollback() {
        const response = await query(this.auth, 'DELETE', this._transaction[1])
        if (response.body.errors.length) {
            let messages = ''
            for (let error of response.body.errors) {
                messages += error.message
            }
            throw new Error(`Database error : ${messages}`)
        } else {
            this._transaction = [0]
            return true
        }
    }
    static async connect(configs) {
        try {
            const response = await query(configs.auth, 'GET', configs.url)
            return () => new Database(response.body, configs.auth)
        } catch (e) {
            if (e.code === 'ECONNREFUSED') {
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve(this.connect(configs))
                    }, 10000)
                })
            }
            throw e
        }
    }
}