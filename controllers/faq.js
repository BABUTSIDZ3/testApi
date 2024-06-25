import express from 'express'
import { queryDatabase } from '../utils/functions'

const faqRouter=express.Router()

faqRouter.get('/',async(req,res)=>{
    const faqQuerry=`SELECT * FROM faq`
    const result=await queryDatabase(faqQuerry)
    res.send(result)
})

export default faqRouter