const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// User Model
const userSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true,unique:true },
    address: { type: String, required: true },
    pinCode: { type: Number, required: true },
    password: { type: String, required: true },
    gender: { type: String, required: true, enum: ['Male', 'Female', 'Other'] },
    orderId: [{ type: Schema.Types.ObjectId, ref: 'Order' }],
    privilege: { type: Boolean, required: true, default: false },
    prescriptionId: [{ type: Schema.Types.ObjectId, ref: 'Prescription' }],
    cart: [{
        medicineId: { type: Schema.Types.ObjectId, ref: 'Stock' },
        quantity: { type: Number, required: true, min: 1 }
    }],
    createdAt: { type: Date, default: Date.now }
});


// Prescription Model
const prescriptionSchema = new Schema({
    doctorName: { type: String, required: true },
    content: { type: String, required: true },
    title: { type: String, required: true },
    desc: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});

// Stock Model
const stockSchema = new Schema({
    productName: { type: String, required: true },
    productPrice: { type: Number, required: true },
    productBrand: { type: String, required: true },
    productDescription: { type: String, required: true },
    productSalt: [{ type: String }], 
    prescriptionRequired: { type: Boolean, required: true },
    stockQuantity: { type: Number, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    typeId: { type: Schema.Types.ObjectId, ref: 'MedicineType', required: true },
    manufacturingDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    listed: { type: Boolean, required: true },
    timeStamp: { type: Date, default: Date.now }
});

// Order Model
const orderSchema = new Schema({
    items: [{
        productId: { type: Schema.Types.ObjectId, ref: 'Stock', required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true } 
    }],
    orderValue: { type: Number, required: true }, 
    paymentMethod: {
        type: String,
        required: true,
        enum: ['UPI', 'Debit Card', 'Credit Card', 'Netbanking', 'COD']
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    prescriptionId: [{ type: Schema.Types.ObjectId, ref: 'Prescription' }],
    orderTime: { type: Date, default: Date.now },
    address: { type: String, required: true },
    pincode: { type: String, required: true },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Approved', 'Cancelled'],
        default: 'Pending' 
    }
});

// Category Model
const categorySchema = new Schema({
    categoryName: {type: String, required: true,unique:true},
    description: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Type of Medicine Model
const medicineTypeSchema = new Schema({
    typeName: { type: String, required: true,unique:true },
    description: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

//Admin Model
const adminSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    privilege: { type: Boolean,required:true, default: true } 
});

const User = mongoose.model('User', userSchema);
const Prescription = mongoose.model('Prescription', prescriptionSchema);
const Stock = mongoose.model('Stock', stockSchema);
const Order = mongoose.model('Order', orderSchema);
const Category = mongoose.model('Category', categorySchema);
const MedicineType = mongoose.model('MedicineType', medicineTypeSchema);
const Admin = mongoose.model('Admin', adminSchema);


module.exports = { User, Prescription, Stock, Order, Category, MedicineType,Admin };
