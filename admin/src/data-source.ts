import { DataSource } from "typeorm";
import { Product } from "./entity/product";
require('dotenv').config();

export const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_DATABASE,
    entities: [Product],
    logging: false,
    synchronize: true,
    subscribers: [],
    migrations: []
})