# c-neo4j-js
Connect to neo4j from js

    import Database from 'c-neo4j-js'
    const db = await Database.connect({
        "url": "http://localhost:7474",
        "auth": "neo4j:123456"
    })

Cypher query

    const client = db()
    await client.cypher('
        CREATE (user:User {name:{name}})
        RETURN user', {name: 'Cyrus'}
    )

Transaction

    const client = db()
    client.transaction()
    await client.cypher('
        CREATE (user:User {name:{name}})
        RETURN user', {name: 'Cyrus'}
    )
    await client.cypher('
        CREATE (user:User {name:{name}})
        RETURN user', {name: 'John'}
    )
    await client.commit()
