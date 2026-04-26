import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { socketUpdateSession } from "../features/sessions/sessionSlice";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";

const BACKEND_URL =
  import.meta.env.VITE_API_URL?.replace("/api", "") ||
  "http://localhost:5001";

const useSocket = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const socketRef = useRef(null);

  useEffect(() => {
    if (!user?._id) return;

    if (socketRef.current) return;

    console.log("🔌 Connecting to:", BACKEND_URL);

    const socket = io(BACKEND_URL, {
      query: { userId: user._id },
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      forceNew: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("🚨 Socket Error:", err.message);
    });

    // 🔥 MAIN FIX
    socket.on("sessionUpdate", (payload) => {
      console.log("📡 Received Update:", payload);

      dispatch(socketUpdateSession(payload));

      if (payload.status === "QUESTIONS_READY") {
        console.log("🚀 Redirecting to interview...");
        navigate(`/interview/${payload.sessionId}`);
      }

      if (payload.status === "GENERATION_FAILED") {
        alert("❌ Failed to generate questions");
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?._id]);

  return socketRef.current;
};

export default useSocket;