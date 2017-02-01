# c-neo4j-js
Connect to neo4j from js

    import Database from 'c-neo4j-js'
    
    (async () => {
        try {
            const db = await Database.connect({
                "url": "http://localhost:7474",
                "auth": "neo4j:123456"
            })
            const client = db()
            const data = await client.cypher('
                CREATE (user:User {name:{name}})
                RETURN user', {name: 'Cyrus'}
            )
            if (data.length) {
                console.log(data[0].user)
            } else {
                console.error('create user error')
            }
        } catch (e) {
            console.error(e.stack)
        }
    })()
