if (process.env.NODE_ENV === 'production') {
    console.log('In prod!!');
} else if (process.env.NODE_ENV === 'development') {
    console.log('In dev!!');
} else {
    console.log('In limbo!!');
}
