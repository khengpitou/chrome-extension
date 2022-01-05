document.getElementById("startButton").addEventListener("click", startButton);

function startButton() {
    document.getElementById("stopButton").style.visibility = "visible";
    document.getElementById("attendantButton").style.visibility = "visible";
    document.getElementById("startButton").style.visibility = "hidden";
    console.log('start');
    displayTimer()
}


let [seconds,minutes,hours] = [0,0,0];
let timerRef = document.querySelector('.timerDisplay');
let int = null;

document.getElementById('startButton').addEventListener('click', ()=>{
    if(int!==null){
        clearInterval(int);
    }
    int = setInterval(displayTimer,1000);
});


function displayTimer(){
    seconds += 1;
        if(seconds == 60){
            seconds = 0;
            minutes++;
            if(minutes == 60){
                minutes = 0;
                hours++;
            }
        }

    let h = hours < 10 ? "0" + hours : hours;
    let m = minutes < 10 ? "0" + minutes : minutes;
    let s = seconds < 10 ? "0" + seconds : seconds;

    timerRef.innerHTML = ` ${h} : ${m} : ${s}`;
}
