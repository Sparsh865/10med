const express = require("express");
const app = express();
const PORT = 3000;
const db = require("./models/collections");
const path = require("path");
const session = require("express-session");
const fs = require('fs');
const mongoose = require('mongoose'); // Ensure mongoose is required

//Session Set-Up
app.use(session({
    secret: 'test@#$123', // Replace with a strong secret
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

//Connection
const { connectMongoDb } = require("./connection");
connectMongoDb("mongodb://127.0.0.1:27017/10med").then(() => console.log("MongoDB Connected"));

//MiddleWares
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

//Custom MiddleWare
function isAdminLoggedIn(req, res, next) {
    if (req.session.isAdmin) {
        return next();
    } else {
        return res.redirect('/login?loginMsg=You+need+to+login+first');
    }
}

function isUserLoggedIn(req, res, next) {
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
            req.session.isUser = false; // Regular users should not be considered logged in
            req.session.user = { id: admin._id, email: admin.email };
            return res.redirect("/admin");
        }

        let user = await db.User.findOne({ email });
        if (user && user.password === password) {
            req.session.isAdmin = false;
            req.session.isUser = true; // Regular users should not be considered logged in
            req.session.user = { id: user._id, email: user.email };
            return res.redirect("/user");
        }

        res.render("login", { loginMsg: "Invalid credentials, please try again." });
    } catch (err) {
        console.error(err);
        res.render("login", { loginMsg: "An error occurred. Please try again later." });
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
// GET route for Admin Page
app.get("/admin", isAdminLoggedIn, async (req, res) => {
    try {
        const { successMsg, errorMsg } = req.query;
        res.render("admin", { successMsg, errorMsg });
    } catch (err) {
        console.error(err);
        res.redirect("/admin?errorMsg=Failed+to+load");
    }
});

// POST route for deleting a user
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

//See All Users - Admin
app.get('/admin/all-users', isAdminLoggedIn, async (req, res) => {
    try {
        const users = await db.User.find();
        res.render('users', { users, successMsg: null, errorMsg: null });
    } catch (err) {
        console.error(err);
        res.redirect('/admin?errorMsg=Failed+to+load+users');
    }
});

//See all Orders - Admin
app.get('/admin/all-orders', isAdminLoggedIn, async (req, res) => {
    try {
        const orders = await db.Order.find().populate('productId').populate('userId');
        res.render('AllOrders', { orders, successMsg: null, errorMsg: null });
    } catch (err) {
        console.error(err);
        res.redirect('/admin?errorMsg=Failed+to+load+orders');
    }
});

// Route to see all prescriptions
app.get('/admin/all-prescriptions', isAdminLoggedIn, async (req, res) => {
    try {
        // Fetch prescriptions and populate the userId field with user details
        const prescriptions = await db.Prescription.find().populate('userId', 'email'); // Only populate the email field of the user

        res.render('allPrescriptions', { prescriptions, successMsg: req.query.successMsg || null, errorMsg: req.query.errorMsg || null });
    } catch (err) {
        console.error(err);
        // Redirect with an error message if fetching prescriptions fails
        res.redirect('/admin/all-prescriptions?errorMsg=Failed+to+load+prescriptions');
    }
});

//Route to see all Stock
app.get('/admin/all-stock', isAdminLoggedIn, async (req, res) => {
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

//Route to add medicine
app.get('/admin/add-medicine', isAdminLoggedIn, async (req, res) => {
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

app.get('/admin/add-category', isAdminLoggedIn, async (req, res) => {
    try {
        const categories = await db.Category.find();
        res.render('addCategory', { errorMsg: null, successMsg: null, categories });
    } catch (error) {
        console.error(error);
        res.render('addCategory', { errorMsg: 'Failed to load categories. Please try again later.', successMsg: null, categories: [] });
    }
});
app.post('/admin/add-category', isAdminLoggedIn, async (req, res) => {
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

app.get('/admin/add-type', isAdminLoggedIn, async (req, res) => {
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

app.post('/admin/add-type', isAdminLoggedIn, async (req, res) => {
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

app.post('/admin/add-medicine', isAdminLoggedIn, async (req, res) => {
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

app.post('/admin/toggle-listed/:id', isAdminLoggedIn, async (req, res) => {
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

app.post('/admin/delete-stock/:id', isAdminLoggedIn, async (req, res) => {
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

app.get('/admin/update-stock/:id', isAdminLoggedIn, async (req, res) => {
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

app.post('/admin/update-stock/:id', isAdminLoggedIn, async (req, res) => {
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

app.post('/admin/remove-category/:id', isAdminLoggedIn, async (req, res) => {
    try {
        const categoryId = req.params.id;
        await db.Category.findByIdAndDelete(categoryId);

        res.render('addCategory', { errorMsg: null, successMsg: 'Category removed successfully!', categories: await db.Category.find() });
    } catch (error) {
        console.error(error);
        res.render('addCategory', { errorMsg: 'An error occurred while removing the category. Please try again later.', successMsg: null, categories: await db.Category.find() });
    }
});

app.post('/admin/remove-type/:id', isAdminLoggedIn, async (req, res) => {
    try {
        const typeId = req.params.id;
        await db.MedicineType.findByIdAndDelete(typeId);

        res.render('addType', { errorMsg: null, successMsg: 'Medicine type removed successfully!', types: await db.MedicineType.find() });
    } catch (error) {
        console.error(error);
        res.render('addType', { errorMsg: 'An error occurred while removing the medicine type. Please try again later.', successMsg: null, types: await db.MedicineType.find() });
    }
});

app.get("/user", isUserLoggedIn, async (req, res) => {
    try {
        res.render("userPanel");
    } catch (err) {
        console.error(err);
        res.redirect("/user?errorMsg=Failed+to+load");
    }
});

app.get("/user/medicines",isUserLoggedIn, async (req, res) => {
    try {
        const medicines = await db.Stock.find({ listed: true });
        res.render("medicines", { medicines });
    } catch (err) {
        console.error(err);
        res.redirect("/?errorMsg=Failed+to+load+medicines");
    }
});
// Route to add item to cart
app.post('/cart/add', isUserLoggedIn, async (req, res) => {
    const { medicineId, quantity } = req.body;
    const userId = req.session.user.id;

    try {
        // Find the user
        const user = await db.User.findById(userId);

        if (!user) {
            return res.redirect('/user/medicines?errorMsg=User+not+found');
        }

        // Check if the medicine is already in the cart
        const existingItem = user.cart.find(item => item.medicineId.toString() === medicineId);

        if (existingItem) {
            // Update quantity if medicine already exists in cart
            existingItem.quantity += parseInt(quantity);
        } else {
            // Add new item to cart
            user.cart.push({ medicineId, quantity: parseInt(quantity) });
        }

        // Save the user document
        await user.save();
        res.redirect('/user/medicines?successMsg=Medicine+added+to+cart');
    } catch (err) {
        console.error(err);
        res.redirect('/user/medicines?errorMsg=Failed+to+add+medicine+to+cart');
    }
});


// Route to view the cart
app.get('/user/cart',isUserLoggedIn, async (req, res) => {
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

app.post('/user/cart/remove', isUserLoggedIn, async (req, res) => {
    const { medicineId } = req.body;
    const userId = req.user.id;
    console.log(medicineId, userId, medicineId._id);
    // Validate the medicineId format
    if (!mongoose.Types.ObjectId.isValid(medicineId._id)) {
        return res.redirect('/user/cart?errorMsg=Invalid+medicine+ID');
    }

    // Convert medicineId to ObjectId
    const medicineObjectId = mongoose.Types.ObjectId(medicineId);

    try {
        // Fetch the user from the database
        const user = await db.User.findById(userId);

        if (!user) {
            return res.redirect('/user/cart?errorMsg=User+not+found');
        }

        // Log cart before removal for debugging
        console.log('Cart before removal:', user.cart);

        // Remove the item from the cart
        user.cart = user.cart.filter(item => item.medicineId.toString() !== medicineObjectId.toString());

        // Log cart after removal for debugging
        console.log('Cart after removal:', user.cart);

        // Save the updated user document
        await user.save();
        res.redirect('/user/cart?successMsg=Medicine+removed+from+cart');
    } catch (err) {
        console.error(err);
        res.redirect('/user/cart?errorMsg=Failed+to+remove+medicine+from+cart');
    }
});

app.get('/user/checkout', isUserLoggedIn, async (req, res) => {
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

        // Determine which medicines require a prescription
        const medicinesRequiringPrescription = cartItems.filter(item => item.prescriptionRequired);

        let prescriptions = [];
        if (medicinesRequiringPrescription.length > 0) {
            prescriptions = await db.Prescription.find({ userId });
        }

        res.render('checkout', {
            cartItems,
            address: user.address || '',
            pincode: user.pincode || '',
            errorMsg: req.query.errorMsg,
            successMsg: req.query.successMsg,
            medicinesRequiringPrescription, // Pass this to the view
            prescriptions // Pass this to the view
        });
    } catch (err) {
        console.error(err);
        res.redirect('/user/cart?errorMsg=Failed+to+load+checkout+page');
    }
});


app.post('/user/checkout', isUserLoggedIn, async (req, res) => {
    const userId = req.session.user.id;
    const { address, pincode, paymentMethod, selectedPrescription } = req.body;

    try {
        // Find the user and their cart items
        const user = await db.User.findById(userId).populate('cart.medicineId').exec();
        if (!user) {
            return res.redirect('/user/cart?errorMsg=User+not+found');
        }

        // Calculate order value and create the order
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
            prescriptionId: selectedPrescription ? [selectedPrescription] : [] // Add selectedPrescription if present
        });

        // Save the order
        await order.save();

        // Update the user with the new order
        user.orderId.push(order._id);
        user.cart = []; // Clear the cart after order is placed
        await user.save();

        res.redirect('/user/checkout?successMsg=Order+placed+successfully');
    } catch (err) {
        console.error(err);
        res.redirect('/user/checkout?errorMsg=Failed+to+place+order');
    }
});

app.get('/user/show-orders', isUserLoggedIn, async (req, res) => {
    try {
        // Fetch orders for the logged-in user and populate the product details
        const orders = await db.Order.find({ userId: req.session.user.id })
            .populate({
                path: 'items.productId',
                select: 'productName'  // Only include the productName field
            })
            .exec();

        console.log(orders); // For debugging
        res.render('show-orders', { orders });
    } catch (err) {
        console.error(err);
        res.render('show-orders', { orders: [], errorMsg: 'Failed to load orders.' });
    }
});


app.get('/admin/show-all-orders', isAdminLoggedIn, async (req, res) => {
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

// Route to update order status
app.post('/admin/update-order-status/:orderId', isAdminLoggedIn, async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!['Pending', 'Approved', 'Cancelled'].includes(status)) {
        return res.redirect('/admin/show-all-orders'); // Redirect if invalid status
    }

    try {
        await db.Order.findByIdAndUpdate(orderId, { status }).exec();
        res.redirect('/admin/show-all-orders'); // Redirect to the orders page after updating
    } catch (err) {
        console.error(err);
        res.redirect('/admin/show-all-orders');
    }
});

app.post('/user/update-details', isUserLoggedIn, async (req, res) => {
    try {
        const { name, phoneNumber, address, pinCode, gender } = req.body;

        // Validate input (optional but recommended)
        if (!name || !phoneNumber || !address || !pinCode || !gender) {
            return res.status(400).send('All fields are required.');
        }

        // Update user details
        await db.User.findByIdAndUpdate(req.session.user.id, {
            name,
            phoneNumber,
            address,
            pinCode,
            gender
        });

        // Optionally, you can update session user data here
        req.session.user = { ...req.session.user, name, phoneNumber, address, pinCode, gender };

        // Redirect to the same page or user dashboard
        res.redirect('/user/update-details'); // Change to user dashboard if needed
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating details.');
    }
});

// Route to handle password change
app.post('/user/change-password', isUserLoggedIn, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Check if new password and confirm password match
        if (newPassword !== confirmPassword) {
            return res.render('update-details', { user: req.session.user, errorMsg: 'Passwords do not match.' });
        }

        // Fetch the user from the database
        const user = await db.User.findById(req.session.user.id).exec();

        // Check if the current password is correct
        if (user.password !== currentPassword) {
            return res.render('update-details', { user: req.session.user, errorMsg: 'Current password is incorrect.' });
        }

        // Update the password
        user.password = newPassword;
        await user.save();

        // Redirect or render a success message
        res.render('update-details', { user: req.session.user, successMsg: 'Password changed successfully.' });
    } catch (err) {
        console.error(err);
        res.render('update-details', { user: req.session.user, errorMsg: 'Failed to change password.' });
    }
});


app.get('/user/update-details', isUserLoggedIn, async (req, res) => {
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

app.get('/user/prescriptions', isUserLoggedIn, async (req, res) => {
    try {
        const prescriptions = await db.Prescription.find({ userId: req.user.id }).exec();
        res.render('prescription', { prescriptions });
    } catch (err) {
        console.error('Error fetching prescriptions:', err); // Debug: Log error
        res.status(500).send('Error fetching prescriptions.');
    }
});

// Route to handle adding a new prescription
app.post('/user/prescriptions', isUserLoggedIn, async (req, res) => {
    try {
        const { doctorName, content, title, desc } = req.body;

        // Create a new prescription
        const newPrescription = new db.Prescription({
            doctorName,
            content,
            title,
            desc,
            userId: req.session.user.id // Store the logged-in user's ID
        });

        const savedPrescription = await newPrescription.save();

        // Update the user's prescription array
        await db.User.findByIdAndUpdate(req.session.user.id, {
            $push: { prescriptionId: savedPrescription._id }
        });

        res.redirect('/user/prescriptions'); // Redirect to the prescription list page
    } catch (err) {
        console.error(err);
        res.status(500).send('Error creating prescription.');
    }
});


// Route to handle editing a prescription
app.get('/user/prescriptions/:id/edit', isUserLoggedIn, async (req, res) => {
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

// Route to handle updating a prescription
app.post('/user/prescriptions/:id/update', isUserLoggedIn, async (req, res) => {
    try {
        const { title, desc, doctorName, content } = req.body;

        // Update the prescription in the database
        await db.Prescription.findByIdAndUpdate(req.params.id, {
            title,
            desc,
            doctorName,
            content
        });

        // Redirect to the user's prescriptions page after updating
        res.redirect('/user/prescriptions');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating prescription.');
    }
});

// Route to handle deleting a prescription
app.post('/user/prescriptions/:id/delete', isUserLoggedIn, async (req, res) => {
    try {
        const prescriptionId = req.params.id;

        // Find and delete the prescription
        const deletedPrescription = await db.Prescription.findByIdAndDelete(prescriptionId);

        if (deletedPrescription) {
            // Remove the prescription ID from the user's prescriptionId array
            await db.User.findByIdAndUpdate(req.session.user.id, {
                $pull: { prescriptionId: prescriptionId }
            });
        }

        // Redirect to the user's prescriptions page after deletion
        res.redirect('/user/prescriptions');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error deleting prescription.');
    }
});

//Server
app.listen(PORT, () => {
    console.log(`Server:${PORT}`);
})