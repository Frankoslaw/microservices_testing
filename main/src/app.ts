import * as express from "express"
import { Request, Response } from "express"
import * as cors from "cors"
import { AppDataSource } from "./data-source"
import { param, validationResult } from 'express-validator'
import * as amqp from "amqplib/callback_api"
import { Product } from "./entity/product"
import axios from "axios"
require('dotenv').config();


AppDataSource.initialize()
    .then(() => {
        const productRepository = AppDataSource.getMongoRepository(Product)

        amqp.connect(`amqp://${process.env.MQTT_USER}:${process.env.MQTT_PASS}@${process.env.MQTT_HOST}:${process.env.MQTT_PORT}/`, (error0, connection) => {
            if(error0){
                throw error0
            }

            connection.createChannel((error1, channel) => {
                if(error1){
                    throw error1
                }

                channel.assertQueue("product_created", {durable: false})
                channel.assertQueue("product_updated", {durable: false})
                channel.assertQueue("product_deleted", {durable: false})

                const app = express()

                app.use(cors({
                    origin: [
                        `http://${process.env.FRONTEND_HOST}:${process.env.FRONTEND_PORT}`, //svelte frontend
                    ]
                }))

                app.use(express.json())

                channel.consume("product_created", async (msg) => {
                    const eventProduct: Product = JSON.parse(msg.content.toString())
                    const product = new Product()

                    product.admin_id = parseInt(eventProduct.id)
                    product.title = eventProduct.title
                    product.image = eventProduct.image
                    product.likes = eventProduct.likes

                    await productRepository.save(product)
                    console.log('product created')
                }, {noAck: true})

                channel.consume("product_updated", async (msg) => {
                    const eventProduct: Product = JSON.parse(msg.content.toString())
                    const product = await productRepository.findOneBy({
                        admin_id: parseInt(eventProduct.id)
                    })

                    productRepository.merge(product, {
                        title: eventProduct.title,
                        image: eventProduct.image,
                        likes: eventProduct.likes
                    })

                    productRepository.save(product)
                    console.log('product updated')
                }, {noAck: true})

                channel.consume("product_deleted", async (msg) => {
                    const admin_id = parseInt(msg.content.toString())
                    await productRepository.deleteOne({
                        admin_id
                    })

                    console.log('product deleted')
                }, {noAck: true})

                //endpoints
                app.get('/api/products', async(req: Request, res: Response) => {
                    const products = await productRepository.find()
                    return res.send(products)
                })

                app.post('/api/products/:id/like', 
                    param("id").exists()
                , async(req: Request, res: Response) => {
                    var err = validationResult(req);

                    if (!err.isEmpty()) {
                        return res.send({
                            message: err.mapped()
                        })
                    }

                    const product = await productRepository.findOneBy(req.params.id)

                    if(product == null){
                        return res.send({
                            message: "Selected id does not exists"
                        })
                    }

                    product.likes++

                    const result = await productRepository.save(product)
                    await axios.post(`http://${process.env.ADMIN_PANEL_HOST}:${process.env.ADMIN_PANEL_PORT}/api/products/${product.admin_id}/like`, {})


                    return res.send(result)
                })

                console.log(`Listening to port: ${process.env.EXPRESS_PORT}`)
                app.listen(process.env.EXPRESS_PORT)

                process.on('beforeExit', () => {
                    console.log('closing')
                    connection.close()
                })
            })
        })
    })
    .catch((error) => console.log(error))