module.exports = {
    eAdmin : function(req,res,next){
        console.log(3434)
        if(!req.isAuthenticated()){
            return next()
        }else{
            console.log(7878)
            req.flash("error_msg","Necessário realizar o login para acessar a página solicitada!")
            res.redirect('_admin/usuario/login')
        }
    }
}