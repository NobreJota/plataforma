module.exports = {
    eAdminLoja : function(req,res,next){
        if(req.isAuthenticated()){
            return next()
        }else{
            console.log('eAdminLoja--error')
            req.flash("error_msg","Necessário realizar o login para acessar a página solicitada!")
            res.redirect('/usuario/loginloja')
        }
    }
}