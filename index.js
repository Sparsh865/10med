const express = require("express");
const app = express();
const PORT = 3000;
const db = require("./models/collections");
const path = require("path");
const session = require("express-session");
const fs = require('fs');
const mongoose = require('mongoose'); 

//Session Set-Up
app.use(session({
    secret: 'test@#$123', 
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

//Connection
const { connectMongoDb } = require("./connection");
connectMongoDb("mongodb://127.0.0.1:27017/10med").then(() => console.log("MongoDB Connected"));

//MiddleWares
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

//Custom MiddleWare
function adminLogIn(req, res, next) {
    if (req.session.isAdmin) {
        return next();
    } else {
        return res.redirect('/login?loginMsg=You+need+to+login+first');
    }
}

function userLogIn(req, res, next) {
    if (req.session.isUser && req.session.user) {
        req.user = req.session.user; // Attach user details to the request object
        return next(); // User is logged in, proceed
    } else {
        return res.redirect('/login?loginMsg=You+need+to+login+first'); // Redirect to login if not logged in
    }
}

//Function to read salts from salts.txt
function getSaltsFromFile() {
    const filePath = path.join(__dirname, 'salt.txt');
    const salts = fs.readFileSync(filePath, 'utf-8').split('\n').map(salt => salt.trim());
    return salts.filter(salt => salt.length > 0);
}

//View Engine
app.set("view engine", "ejs");
app.set('views', path.resolve("./views"));

//Home Page
app.get("/", (req, res) => {
    res.render("login",{loginMsg:null});
})

//SignUp Page 
app.get("/signup", (req, res) => {
    res.render("signUp", { errorMsg: null });
});

app.post("/signup", async (req, res) => {
    const { name, email, phoneNumber, address, pinCode, password, gender } = req.body;
    try {
        const newUser = new db.User({
            name,
            email,
            phoneNumber,
            address,
            pinCode,
            password,
            gender
        });
        await newUser.save();
        res.render("login",{loginMsg:null});
    } catch (err) {
        console.error(err);
        res.render("signUp", { errorMsg: "Error signing up, please try again." });
    }
});

//Login Page
app.get("/login", (req, res) => {
    const loginMsg = req.query.loginMsg || null;
    res.render("login", { loginMsg });
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        let admin = await db.Admin.findOne({ email });
        if (admin && admin.password === password) {
            // Set session for admin
            req.session.isAdmin = true;
            req.session.isUser = false;
            req.session.user = { id: admin._id, email: admin.email };
            return res.redirect("/admin");
        }
        let user = await db.User.findOne({ email });
        if (user && user.password === password) {
            //Set Session for user
            req.session.isAdmin = false;
            req.session.isUser = true; 
            req.session.user = { id: user._id, email: user.email };
            return res.redirect("/user");
        }
        res.render("login", { loginMsg: "Invalid credentials" });
    } catch (err) {
        console.error(err);
        res.render("login", { loginMsg: "Error" });
    }
});

//Forgot Password
app.get("/forgot-password", (req, res) => {
    res.render("forgot-password", { errorMsg: null, successMsg: null });
});

app.post("/forgot-password", async (req, res) => {
    const { email, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
        return res.render("forgot-password", { errorMsg: "Password do not match. Please try again.", successMsg: null });
    }
    try {
        // Check if the email exists in the User collection
        let user = await db.User.findOne({ email });
        if (user) {
            user.password = newPassword;
            await user.save();
            return res.render("forgot-password", { successMsg: "Password updated successfully.", errorMsg: null });
        }
        // Email doesn't exist in either collection
        return res.render("forgot-password", { errorMsg: "Account does not exist. Please check the email and try again.", successMsg: null });
    } catch (err) {
        console.error(err);
        return res.render("forgot-password", { errorMsg: "An error occurred. Please try again later.", successMsg: null });
    }
});

//Admin Page
app.get("/admin", adminLogIn, async (req, res) => {
    try {
        const { successMsg, errorMsg } = req.query;
        res.render("admin", { successMsg, errorMsg });
    } catch (err) {
        console.error(err);
        res.redirect("/admin?errorMsg=Failed+to+load");
    }
});

//See All Users - Admin
app.get('/admin/all-users', adminLogIn, async (req, res) => {
    try {
        const users = await db.User.find();
        res.render('users', { users, successMsg: null, errorMsg: null });
    } catch (err) {
        console.error(err);
        res.redirect('/admin?errorMsg=Failed+to+load+users');
    }
});

//Delete User Admin
app.post("/admin/delete-user", async (req, res) => {
    const { userId } = req.body;
    try {
        await db.User.findByIdAndDelete(userId);
        res.redirect("/admin?successMsg=User+deleted+successfully");
    } catch (err) {
        console.error(err);
        res.redirect("/admin?errorMsg=Error+deleting+user");
    }
});

//See all Orders - Admin
app.get('/admin/all-orders', adminLogIn, async (req, res) => {
    try {
        const orders = await db.Order.find().populate('productId').populate('userId');
        res.render('AllOrders', { orders, successMsg: null, errorMsg: null });
    } catch (err) {
        console.error(err);
        res.redirect('/admin?errorMsg=Failed+to+load+orders');
    }
});

// see all prescriptions - admin
app.get('/admin/all-prescriptions', adminLogIn, async (req, res) => {
    try {
        const prescriptions = await db.Prescription.find().populate('userId', 'email'); 
        res.render('allPrescriptions', { prescriptions, successMsg: req.query.successMsg || null, errorMsg: req.query.errorMsg || null });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/all-prescriptions?errorMsg=Failed+to+load+prescriptions');
    }
});

//See all Stock -admin
app.get('/admin/all-stock', adminLogIn, async (req, res) => {
    try {
        const stock = await db.Stock.find()
            .populate('categoryId', 'categoryName')
            .populate('typeId', 'typeName')
            .exec();

        res.render('Stock', { stock, successMsg: null, errorMsg: null });
    } catch (err) {
        console.error(err);
        res.redirect('/admin?errorMsg=Failed+to+load+stock+items');
    }
});

//See Categories  - admin
app.get('/admin/add-category', adminLogIn, async (req, res) => {
    try {
        const categories = await db.Category.find();
        res.render('addCategory', { errorMsg: null, successMsg: null, categories });
    } catch (error) {
        console.error(error);
        res.render('addCategory', { errorMsg: 'Failed to load categories. Please try again later.', successMsg: null, categories: [] });
    }
});
//Add category - admin
app.post('/admin/add-category', adminLogIn, async (req, res) => {
    try {
        const { categoryName, categoryDescription } = req.body;

        const newCategory = await db.Category.create({
            categoryName,
            description: categoryDescription
        });

        res.redirect('/admin/add-category?successMsg=' + encodeURIComponent('Category added successfully'));
    } catch (error) {
        console.error(error);
        res.redirect('/admin/add-category?errorMsg=' + encodeURIComponent('Failed to add category'));
    }
});

//Add Type - admin
app.get('/admin/add-type', adminLogIn, async (req, res) => {
    try {
        const types = await db.MedicineType.find();
        const successMsg = req.query.successMsg || null;
        const errorMsg = req.query.errorMsg || null;

        res.render('addType', { types, successMsg, errorMsg });
    } catch (error) {
        console.error(error);
        res.render('addType', { types: [], successMsg: null, errorMsg: 'Failed to load medicine types' });
    }
});

app.post('/admin/add-type', adminLogIn, async (req, res) => {
    try {
        const { typeName, typeDescription } = req.body;

        const newType = await db.MedicineType.create({
            typeName,
            description: typeDescription
        });
        res.redirect('/admin/add-type?successMsg=' + encodeURIComponent('Medicine type added successfully'));
    } catch (error) {
        console.error(error);
        res.redirect('/admin/add-type?errorMsg=' + encodeURIComponent('Failed to add medicine type'));
    }
});

//Add medicine - admin
app.get('/admin/add-medicine', adminLogIn, async (req, res) => {
    try {
        const categories = await db.Category.find();
        const types = await db.MedicineType.find();
        const salts = getSaltsFromFile();

        const successMsg = req.query.successMsg || null;
        const errorMsg = req.query.errorMsg || null;

        res.render('addMedicine', { categories, salts, types, successMsg, errorMsg });
    } catch (error) {
        console.error(error);
        res.render('addMedicine', { categories: [], salts: [], types: [], successMsg: null, errorMsg: 'Failed to load data' });
    }
});

app.post('/admin/add-medicine', adminLogIn, async (req, res) => {
    try {
        const {
            productName,
            productPrice,
            productBrand,
            productDescription,
            prescriptionRequired,
            stockQuantity,
            categoryId,
            typeId,
            manufacturingDate,
            expiryDate,
            listed,
            productSalt
        } = req.body;

        const newMedicine = await db.Stock.create({
            productName,
            productPrice,
            productBrand,
            productDescription,
            prescriptionRequired: prescriptionRequired === 'on', 
            stockQuantity,
            categoryId,
            typeId,
            manufacturingDate,
            expiryDate,
            listed: listed === 'on', 
            productSalt: Array.isArray(productSalt) ? productSalt : [productSalt]
        });
        res.redirect('/admin/add-medicine?successMsg=' + encodeURIComponent('Medicine added successfully'));
    } catch (error) {
        console.error(error);
        res.redirect('/admin/add-medicine?errorMsg=' + encodeURIComponent('Failed to add medicine'));
    }
});

//Listed/Unlisted - Admin
app.post('/admin/toggle-listed/:id', adminLogIn, async (req, res) => {
    try {
        const { id } = req.params;
        const item = await db.Stock.findById(id);
        if (!item) {
            return res.status(404).send('Stock item not found');
        }
        item.listed = !item.listed;
        await item.save();
        res.redirect('/admin/all-stock');  
    } catch (error) {
        console.error(error);
        res.status(500).send('Failed to update stock item');
    }
});

//Delete Stock - Admin
app.post('/admin/delete-stock/:id', adminLogIn, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.Stock.findByIdAndDelete(id);
        if (!result) {
            return res.status(404).send('Stock item not found');
        }
        res.redirect('/admin/all-stock');  
    } catch (error) {
        console.error(error);
        res.status(500).send('Failed to delete stock item');
    }
});

//Update Stock- admin
app.get('/admin/update-stock/:id', adminLogIn, async (req, res) => {
    try {
        const stockItem = await db.Stock.findById(req.params.id).populate('categoryId').populate('typeId');
        const categories = await db.Category.find(); 
        const types = await db.MedicineType.find(); 

        if (!stockItem) {
            return res.render('updateStock', { errorMsg: 'Stock item not found.', successMsg: null, stockItem: null, categories, types });
        }
        res.render('updateStock', { errorMsg: null, successMsg: null, stockItem, categories, types });
    } catch (error) {
        console.error(error);
        res.render('updateStock', { errorMsg: 'An error occurred while fetching the stock item. Please try again later.', successMsg: null, stockItem: null, categories: [], types: [] });
    }
});

app.post('/admin/update-stock/:id', adminLogIn, async (req, res) => {
    try {
        const { productName, categoryId, typeId, productPrice, stockQuantity, prescriptionRequired, manufacturingDate, expiryDate } = req.body;

        const updatedStock = await db.Stock.findByIdAndUpdate(req.params.id, {
            productName,
            categoryId,
            typeId,
            productPrice,
            stockQuantity,
            prescriptionRequired: prescriptionRequired === 'true',
            manufacturingDate,
            expiryDate
        });

        const categories = await db.Category.find();
        const types = await db.MedicineType.find();

        if (!updatedStock) {
            return res.render('updateStock', { errorMsg: 'Failed to update the stock item. Item not found.', successMsg: null, stockItem: null, categories, types });
        }
        res.render('updateStock', { errorMsg: null, successMsg: 'Stock item updated successfully!', stockItem: updatedStock, categories, types });
    } catch (error) {
        console.error(error);
        const categories = await db.Category.find();
        const types = await db.MedicineType.find();

        res.render('updateStock', { errorMsg: 'An error occurred while updating the stock item. Please try again later.', successMsg: null, stockItem: null, categories, types });
    }
});

//Remove Category - admin
app.post('/admin/remove-category/:id', adminLogIn, async (req, res) => {
    try {
        const categoryId = req.params.id;
        await db.Category.findByIdAndDelete(categoryId);
        res.render('addCategory', { errorMsg: null, successMsg: 'Category removed successfully!', categories: await db.Category.find() });
    } catch (error) {
        console.error(error);
        res.render('addCategory', { errorMsg: 'An error occurred while removing the category. Please try again later.', successMsg: null, categories: await db.Category.find() });
    }
});

app.post('/admin/remove-type/:id', adminLogIn, async (req, res) => {
    try {
        const typeId = req.params.id;
        await db.MedicineType.findByIdAndDelete(typeId);

        res.render('addType', { errorMsg: null, successMsg: 'Medicine type removed successfully!', types: await db.MedicineType.find() });
    } catch (error) {
        console.error(error);
        res.render('addType', { errorMsg: 'An error occurred while removing the medicine type. Please try again later.', successMsg: null, types: await db.MedicineType.find() });
    }
});

//Show All Orders - admin
app.get('/admin/show-all-orders', adminLogIn, async (req, res) => {
    try {
        const orders = await db.Order.find().populate({
            path: 'items.productId',
            select: 'productName'
        }).exec();
        res.render('show-all-orders', { orders });
    } catch (err) {
        console.error(err);
        res.render('show-all-orders', { orders: [], errorMsg: 'Failed to load orders.' });
    }
});

//Update Order Status - Admin
app.post('/admin/update-order-status/:orderId', adminLogIn, async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!['Pending', 'Approved', 'Cancelled'].includes(status)) {
        return res.redirect('/admin/show-all-orders');
    }
    try {
        await db.Order.findByIdAndUpdate(orderId, { status }).exec();
        res.redirect('/admin/show-all-orders');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/show-all-orders');
    }
});

//User
app.get("/user", userLogIn, async (req, res) => {
    try {
        res.render("userPanel");
    } catch (err) {
        console.error(err);
        res.redirect("/user?errorMsg=Failed+to+load");
    }
});

//See all medicines - User
app.get("/user/medicines",userLogIn, async (req, res) => {
    try {
        const medicines = await db.Stock.find({ listed: true });
        res.render("medicines", { medicines });
    } catch (err) {
        console.error(err);
        res.redirect("/?errorMsg=Failed+to+load+medicines");
    }
});

// View cart - user
app.get('/user/cart', userLogIn, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const user = await db.User.findById(userId).populate('cart.medicineId');

        if (!user) {
            return res.redirect('/user/cart?errorMsg=User+not+found');
        }

        const cart = user.cart || [];
        const totalAmount = cart.reduce((total, item) => total + (item.medicineId.productPrice * item.quantity), 0);

        res.render('cart', {
            cart,
            totalAmount,
            successMsg: req.query.successMsg || '',
            errorMsg: req.query.errorMsg || ''
        });
    } catch (err) {
        console.error(err);
        res.redirect('/user/cart?errorMsg=Failed+to+load+cart');
    }
});

//Add item to cart - user
app.post('/cart/add', userLogIn, async (req, res) => {
    const { medicineId, quantity } = req.body;
    const userId = req.session.user.id;
    try {
        const user = await db.User.findById(userId);
        if (!user) {
            return res.redirect('/user/medicines?errorMsg=User+not+found');
        }
        const existingItem = user.cart.find(item => item.medicineId.toString() === medicineId);
        if (existingItem) {
            existingItem.quantity += parseInt(quantity);
        } else {
            user.cart.push({ medicineId, quantity: parseInt(quantity) });
        }
        await user.save();
        res.redirect('/user/medicines?successMsg=Medicine+added+to+cart');
    } catch (err) {
        console.error(err);
        res.redirect('/user/medicines?errorMsg=Failed+to+add+medicine+to+cart');
    }
});

//Checkout - User
app.get('/user/checkout', userLogIn, async (req, res) => {
    const userId = req.session.user.id;
    try {
        const user = await db.User.findById(userId).populate('cart.medicineId').exec();
        if (!user) {
            return res.redirect('/user/cart?errorMsg=User+not+found');
        }
        const cartItems = user.cart.map(item => ({
            ...item.medicineId._doc,
            quantity: item.quantity
        }));
        const medicinesRequiringPrescription = cartItems.filter(item => item.prescriptionRequired);
        let prescriptions = [];
        if (medicinesRequiringPrescription.length > 0) {
            prescriptions = await db.Prescription.find({ userId });
        }
        res.render('checkout', {
            cartItems,
            address: user.address || '',
            pincode: user.pinCode || '',
            errorMsg: req.query.errorMsg,
            successMsg: req.query.successMsg,
            medicinesRequiringPrescription, 
            prescriptions
        });
    } catch (err) {
        console.error(err);
        res.redirect('/user/cart?errorMsg=Failed+to+load+checkout+page');
    }
});

app.post('/user/checkout', userLogIn, async (req, res) => {
    const userId = req.session.user.id;
    const { address, pincode, paymentMethod, selectedPrescription } = req.body;
    try {
        const user = await db.User.findById(userId).populate('cart.medicineId').exec();
        if (!user) {
            return res.redirect('/user/cart?errorMsg=User+not+found');
        }
        const items = user.cart.map(item => ({
            productId: item.medicineId._id,
            quantity: item.quantity,
            price: item.medicineId.productPrice
        }));
        const orderValue = items.reduce((total, item) => total + (item.quantity * item.price), 0);
        const order = new db.Order({
            items,
            orderValue,
            paymentMethod,
            userId: user._id,
            address,
            pincode,
            status: 'Pending',
            prescriptionId: selectedPrescription ? [selectedPrescription] : []
        });
        await order.save();
        user.orderId.push(order._id);
        user.cart = []; 
        await user.save();
        res.redirect('/user/checkout?successMsg=Order+placed+successfully');
    } catch (err) {
        console.error(err);
        res.redirect('/user/checkout?errorMsg=Failed+to+place+order');
    }
});

//Show Orders - user
app.get('/user/show-orders', userLogIn, async (req, res) => {
    try {
        const orders = await db.Order.find({ userId: req.session.user.id })
            .populate({
                path: 'items.productId',
                select: 'productName'  
            })
            .exec();
        res.render('show-orders', { orders });
    } catch (err) {
        console.error(err);
        res.render('show-orders', { orders: [], errorMsg: 'Failed to load orders.' });
    }
});

//Update Details - user
app.get('/user/update-details', userLogIn, async (req, res) => {
    try {
        const user = await db.User.findById(req.session.user.id).exec();
        if (!user) {
            return res.status(404).send('User not found.');
        }
        res.render('update-details', { user });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching user details.');
    }
});

app.post('/user/update-details', userLogIn, async (req, res) => {
    try {
        const { name, phoneNumber, address, pinCode, gender } = req.body;
        if (!name || !phoneNumber || !address || !pinCode || !gender) {
            return res.status(400).send('All fields are required.');
        }
        await db.User.findByIdAndUpdate(req.session.user.id, {
            name,
            phoneNumber,
            address,
            pinCode,
            gender
        });
        req.session.user = { ...req.session.user, name, phoneNumber, address, pinCode, gender };
        res.redirect('/user/update-details'); 
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating details.');
    }
});

//Change Password - User
app.post('/user/change-password', userLogIn, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        if (newPassword !== confirmPassword) {
            return res.render('update-details', { user: req.session.user, errorMsg: 'Passwords do not match.' });
        }
        const user = await db.User.findById(req.session.user.id).exec();
        if (user.password !== currentPassword) {
            return res.render('update-details', { user: req.session.user, errorMsg: 'Current password is incorrect.' });
        }
        user.password = newPassword;
        await user.save();
        res.render('update-details', { user: req.session.user, successMsg: 'Password changed successfully.' });
    } catch (err) {
        console.error(err);
        res.render('update-details', { user: req.session.user, errorMsg: 'Failed to change password.' });
    }
});

//See Prescriptions - User
app.get('/user/prescriptions', userLogIn, async (req, res) => {
    try {
        const prescriptions = await db.Prescription.find({ userId: req.user.id }).exec();
        res.render('prescription', { prescriptions });
    } catch (err) {
        console.error('Error:', err); 
        res.status(500).send('Error fetching prescriptions.');
    }
});

//Add a new Prescription - User
app.post('/user/prescriptions', userLogIn, async (req, res) => {
    try {
        const { doctorName, content, title, desc } = req.body;
        const newPrescription = new db.Prescription({
            doctorName,
            content,
            title,
            desc,
            userId: req.session.user.id 
        });
        const savedPrescription = await newPrescription.save();
        await db.User.findByIdAndUpdate(req.session.user.id, {
            $push: { prescriptionId: savedPrescription._id }
        });
        res.redirect('/user/prescriptions'); 
    } catch (err) {
        console.error(err);
        res.status(500).send('Error creating prescription.');
    }
});

// Edit Prescription - User
app.get('/user/prescriptions/:id/edit', userLogIn, async (req, res) => {
    try {
        const prescription = await db.Prescription.findById(req.params.id).exec();
        if (!prescription) {
            return res.status(404).send('Prescription not found.');
        }
        res.render('edit-prescription', { prescription });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching prescription.');
    }
});

// Update a Prescription - user
app.post('/user/prescriptions/:id/update', userLogIn, async (req, res) => {
    try {
        const { title, desc, doctorName, content } = req.body;
        await db.Prescription.findByIdAndUpdate(req.params.id, {
            title,
            desc,
            doctorName,
            content
        });
        res.redirect('/user/prescriptions');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating prescription.');
    }
});

// Delete prescription - user
app.post('/user/prescriptions/:id/delete', userLogIn, async (req, res) => {
    try {
        const prescriptionId = req.params.id;
        const deletedPrescription = await db.Prescription.findByIdAndDelete(prescriptionId);
        if (deletedPrescription) {
            await db.User.findByIdAndUpdate(req.session.user.id, {
                $pull: { prescriptionId: prescriptionId }
            });
        }
        res.redirect('/user/prescriptions');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error deleting prescription.');
    }
});

//Logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Failed to destroy session:', err);
            return res.redirect('/admin');
        }
        res.redirect('/login');
    });
});

//Server
app.listen(PORT, () => {
    console.log(`Server:${PORT}`);
})