'use strict'

import url from 'url'
import http from 'http'

const query = (auth, _url, statements) => {
    _url = url.parse(_url)
    let options = {
        host: _url.hostname,
        port: _url.port,
        path: _url.path,
        auth: auth,
        method: (statements) ? 'POST' : 'GET',
        headers: {
            'Accept': 'application/json; charset=UTF-8',
            'Connection': 'keep-alive',
            'X-Stream': 'true'
        }
    }
    if (statements){
        statements = JSON.stringify(statements)
        options.headers['Content-Type'] = 'application/json'
        options.headers['Content-Length'] = statements.length
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
        if (statements){
            req.write(statements)
        }
        req.end()
    })
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
        const response = await query(this.auth, url, statements)
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
            const response = await query(this.auth, `${this._transaction[1]}/commit`, {statements:[]})
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
    static async connect(configs) {
        const res = await query(configs.auth, configs.url)
        return () => new Database(res.body, configs.auth)
    }
}