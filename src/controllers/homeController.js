import db from "../models/index";
import CRUDService from "../services/CRUDService";


const getHomepage = async (req, res) => {
    try {
        let data = await db.User.findAll();

        return res.render('homepage.ejs', {
            data: JSON.stringify(data)
        });
    } catch (e) {
        console.log(e)
    }
}

const getAboutPage = (req, res) => {
    return res.render('test/about.ejs');
}

const getCRUD = (req, res) => {
    return res.render('crud.ejs');
}
const postCRUD = async (req, res) => {
    let message = await CRUDService.createNewUser(req.body)
    console.log(message)
    return res.send('post crud from server ')
}

const displayGetCRUD = async (req, res) => {
    let data = await CRUDService.getAllUser();
    return res.render('displayCRUD.ejs', {
        dataTable: data
    })
}
const getEditCRUD = async (req, res) => {
    let userId = req.query.id;

    if (userId) {
        let userData = await CRUDService.getUserInfoById(userId);

        return res.render('editCRUD.ejs', {
            user: userData
        });

    } else {
        return res.send('Users not found !')
    }
}

const putCRUD = async (req, res) => {
    let data = req.body;
    let allUsers = await CRUDService.updateUserData(data);
    return res.render('displayCRUD.ejs', {
        dataTable: allUsers
    })
}
const deleteCRUD = async (req, res) => {
    let id = req.query.id;
    if (id) {
        await CRUDService.deleteUserById(id);
        return res.send('Delete the user succeed!')

    }
    else {
        return res.send('user not found')

    }
}

module.exports = {
    getHomepage: getHomepage,
    getAboutPage: getAboutPage,
    getCRUD: getCRUD,
    postCRUD: postCRUD,
    displayGetCRUD: displayGetCRUD,
    getEditCRUD: getEditCRUD,
    putCRUD: putCRUD,
    deleteCRUD: deleteCRUD,
}