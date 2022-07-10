This is project for testing microservices architecture current design is made from 2 services

admin - allows to create products
main -allows to brows and like product

both services are independent and failur of one of them don't stop whole system from operating, admin service uses
mysql as a database and main uses mongo db, both databeses are kept in sync through amqp events transmited through
rabbit mq queue

TODO:
    - create ui using svelte or vue