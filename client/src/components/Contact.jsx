import Avatar from "../Avatar.jsx";

export default function Contact({id,username,selected,setSelectedUser,online}) {
    return (
        <>
            <div key={id}
                 onClick={() => setSelectedUser(id)}
                 className={`flex items-center gap-2 border-b border-gray-200 cursor-pointer ${id === selected ? 'bg-indigo-100' : ''}`}>
                {selected && (
                    <div className='w-1 bg-indigo-500 h-12 rounded-r-md'></div>
                )}
                <div className="flex gap-2 py-2 pl-4 items-center">
                    <Avatar online={online} username={username} userId={id} />
                    <span className="text-gray-800">{username}</span>
                </div>
            </div>
        </>
    )
}