import * as express from "express"
import { Request, Response } from "express"
import * as cors from "cors"
import { AppDataSource } from "./data-source.js"
import { Product } from "./entity/product.js"
import { body, param, validationResult } from 'express-validator'
import * as amqp from "amqplib/callback_api"
require('dotenv').config();


AppDataSource.initialize()
    .then(() => {
        const productRepository = AppDataSource.getRepository(Product)
        amqp.connect(`amqp://${process.env.MQTT_USER}:${process.env.MQTT_PASS}@${process.env.MQTT_HOST}:${process.env.MQTT_PORT}/`, (error0, connection) => {
            if(error0){
                throw error0
            }

            connection.createChannel((error1, channel) => {
                if(error1){
                    throw error1
                }

                const app = express()

                app.use(cors({
                    origin: [
                        `http://${process.env.FRONTEND_HOST}:${process.env.FRONTEND_PORT}`, //svelte frontend
                    ]
                }))

                app.use(express.json())

                //endpointys
                app.get('/api/products', async (req: Request, res: Response) => {
                    const products = await productRepository.find()

                    res.json(products)
                })

                app.post('/api/products',
                    body("title").exists(),
                    body("image").exists()
                , async (req: Request, res: Response) => {
                    var err = validationResult(req);

                    if (!err.isEmpty()) {
                        return res.send({
                            message: err.mapped()
                        })
                    }

                    const product = await productRepository.create(req.body)
                    const result = await productRepository.save(product)

                    channel.sendToQueue('product_created', Buffer.from(JSON.stringify(result)))

                    return res.send(result)
                })

                app.get('/api/products/:id', 
                    param("id").isInt().toInt()
                , async (req: Request, res: Response) => {
                    var err = validationResult(req);

                    if (!err.isEmpty()) {
                        return res.send({
                            message: err.mapped()
                        })
                    }

                    const product = await productRepository.findOneBy({
                        id: Number(req.params.id)
                    })

                    return res.send(product)
                })

                app.put('/api/products/:id', 
                    param("id").isInt().toInt(),
                    body("title").exists(),
                    body("image").exists()
                , async (req: Request, res: Response) => {
                    var err = validationResult(req);

                    if (!err.isEmpty()) {
                        return res.send({
                            message: err.mapped()
                        })
                    }

                    const product = await productRepository.findOneBy({
                        id: Number(req.params.id)
                    })

                    if(product == null)
                        return res.send({
                            message: "Selected id does not exists"
                        })

                    productRepository.merge(product, req.body)

                    const result = await productRepository.save(product)

                    channel.sendToQueue('product_updated', Buffer.from(JSON.stringify(result)))

                    return res.send(result)
                })

                app.delete('/api/products/:id', 
                    param("id").isInt().toInt()
                , async (req: Request, res: Response) => {
                    var err = validationResult(req);

                    if (!err.isEmpty()) {
                        return res.send({
                            message: err.mapped()
                        })
                    }

                    const result = await productRepository.delete({
                        id: Number(req.params.id)
                    })

                    channel.sendToQueue('product_deleted', Buffer.from(req.params.id.toString()))

                    return res.send(result)
                })

                app.post('/api/products/:id/like', 
                    param("id").isInt().toInt()
                , async (req: Request, res: Response) => {
                    var err = validationResult(req);

                    if (!err.isEmpty()) {
                        return res.send({
                            message: err.mapped()
                        })
                    }

                    const product = await productRepository.findOneBy({
                        id: Number(req.params.id)
                    })

                    if(product == null){
                        return res.send({
                            message: "Selected id does not exists"
                        })
                    }

                    product.likes++

                    const result = await productRepository.save(product)


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